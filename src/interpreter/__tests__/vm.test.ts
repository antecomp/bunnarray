import { describe, expect, it } from 'vitest';
import type { Program } from '../../compiler/instructions';
import build from '../../compiler/build';
import createVM from '../vm';

type Step = ReturnType<ReturnType<typeof createVM>['init']>;

function expectSay(step: Step, text: string) {
    expect(step).toMatchObject({ kind: 'say', presentation: { text } });
    if (step.kind !== 'say') throw new Error('Expected a say yield');
    return step;
}

function expectChoice(step: Step, text: string | null, choices: string[]) {
    expect(step).toMatchObject({ kind: 'choice', presentation: text === null ? null : { text }, choices });
    if (step.kind !== 'choice') throw new Error('Expected a choice yield');
    return step;
}

describe('VM', () => {
    it('ends an empty program immediately', () => {
        const vm = createVM({ instructions: [{ op: 'END' }] });
        expect(vm.init()).toEqual({ kind: 'end', presentation: null });
    });

    it('shows the last line before ending', () => {
        const vm = createVM({ instructions: [
            { op: 'SAY', text: 'Only line' },
            { op: 'END' }
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Only line', speaker: null } });
    });

    it('shows consecutive lines in order, each exactly once', () => {
        const vm = createVM({ instructions: [
            { op: 'SAY', text: 'First' },
            { op: 'SAY', text: 'Second' },
            { op: 'SAY', text: 'Third' },
            { op: 'END' }
        ] });

        const first = expectSay(vm.init(), 'First');
        const second = expectSay(first.resume(), 'Second');
        expect(second.resume()).toEqual({ kind: 'end', presentation: { text: 'Third', speaker: null } });
    });

    it('jumps to its target without executing the skipped instruction', () => {
        const vm = createVM({ instructions: [
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' }
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Reached', speaker: null } });
    });

    it.each([
        [0, 'Left'],
        [1, 'Right']
    ])('follows choice %i and rejoins after its branch', (index, branchText) => {
        const program: Program = { instructions: [
            { op: 'SAY', text: 'Pick one' },
            { op: 'CHOICE', choices: [
                { text: 'left', target: 2 },
                { text: 'right', target: 4 }
            ] },
            { op: 'SAY', text: 'Left' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'Right' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'After choice' },
            { op: 'END' }
        ] };

        const choice = expectChoice(createVM(program).init(), 'Pick one', ['left', 'right']);
        const branch = expectSay(choice.resume(index), branchText);
        expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'After choice', speaker: null } });
    });

    it('supports a choice without a preceding prompt', () => {
        const vm = createVM({ instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }] },
            { op: 'SAY', text: 'Going' },
            { op: 'END' }
        ] });

        const choice = expectChoice(vm.init(), null, ['go']);
        expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Going', speaker: null } });
    });

    it('rejects repeated initialization and repeated resumes', () => {
        const vm = createVM({ instructions: [
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'END' }
        ] });

        const first = expectSay(vm.init(), 'One');
        expect(() => vm.init()).toThrow('Resume callback already consumed');
        expect(first.resume()).toEqual({ kind: 'end', presentation: { text: 'Two', speaker: null } });
        expect(() => first.resume()).toThrow('Resume callback already consumed');
    });

    it('rejects an invalid choice index and a repeated choice resume', () => {
        const vm = createVM({ instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }] },
            { op: 'END' }
        ] });

        const choice = expectChoice(vm.init(), null, ['go']);
        expect(() => choice.resume(1)).toThrow('Invalid choice index: 1');
        expect(() => choice.resume(0)).toThrow('Resume callback already consumed');
    });

    it('sets, inherits, changes, and clears the speaker from dialogue source', () => {
        const vm = createVM(build(`:SPEAKER Alice
Hello
Still me
:SPEAKER Bob
Hi
:SPEAKER
Narration`));

        const hello = vm.init();
        expect(hello).toMatchObject({ kind: 'say', presentation: { text: 'Hello', speaker: 'Alice' } });
        if (hello.kind !== 'say') throw new Error('Expected a say yield');

        const stillMe = hello.resume();
        expect(stillMe).toMatchObject({ kind: 'say', presentation: { text: 'Still me', speaker: 'Alice' } });
        if (stillMe.kind !== 'say') throw new Error('Expected a say yield');

        const hi = stillMe.resume();
        expect(hi).toMatchObject({ kind: 'say', presentation: { text: 'Hi', speaker: 'Bob' } });
        if (hi.kind !== 'say') throw new Error('Expected a say yield');

        expect(hi.resume()).toEqual({ kind: 'end', presentation: { text: 'Narration', speaker: null } });
    });

    it('cycles speakers on each spoken line and keeps the last one when alternation stops', () => {
        const vm = createVM(build(`:ALTERNATE Alice; Bob Smith; Carol
First
Second
Third
Fourth
:ALTERNATE
After`));

        let step = vm.init();
        for (const [text, speaker] of [
            ['First', 'Alice'],
            ['Second', 'Bob Smith'],
            ['Third', 'Carol'],
            ['Fourth', 'Alice']
        ]) {
            expect(step).toMatchObject({ kind: 'say', presentation: { text, speaker } });
            if (step.kind !== 'say') throw new Error('Expected a say yield');
            step = step.resume();
        }

        expect(step).toEqual({ kind: 'end', presentation: { text: 'After', speaker: 'Alice' } });
    });

    it('lets SPEAKER override alternation and a later ALTERNATE restart it', () => {
        const vm = createVM(build(`:ALTERNATE Alice; Bob
First
:SPEAKER Manual
Second
:ALTERNATE Carol; Dave
Third
Fourth`));

        const first = expectSay(vm.init(), 'First');
        expect(first.presentation.speaker).toBe('Alice');
        const second = expectSay(first.resume(), 'Second');
        expect(second.presentation.speaker).toBe('Manual');
        const third = expectSay(second.resume(), 'Third');
        expect(third.presentation.speaker).toBe('Carol');
        expect(third.resume()).toEqual({ kind: 'end', presentation: { text: 'Fourth', speaker: 'Dave' } });
    });

    it.each([0, 1])('only advances alternation for spoken choice branch %i', index => {
        const vm = createVM(build(`:ALTERNATE Alice; Bob
{
?: left
Left
?: right
Right
}
After`));

        const choice = expectChoice(vm.init(), null, ['left', 'right']);
        const branch = expectSay(choice.resume(index), index === 0 ? 'Left' : 'Right');
        expect(branch.presentation.speaker).toBe('Alice');
        expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: 'Bob' } });
    });

    describe('MATCH', () => {
        const program: Program = { instructions: [
            { op: 'MATCH', on: 'state', cases: { ready: 1, waiting: 3, '': 5 }, fallback: 7 },
            { op: 'SAY', text: 'Ready' },
            { op: 'JUMP', target: 7 },
            { op: 'SAY', text: 'Waiting' },
            { op: 'JUMP', target: 7 },
            { op: 'SAY', text: 'Empty value' },
            { op: 'JUMP', target: 7 },
            { op: 'SAY', text: 'After match' },
            { op: 'END' }
        ] };

        it.each([
            ['ready', 'Ready'],
            ['waiting', 'Waiting'],
            ['', 'Empty value']
        ])('executes case %j and rejoins at the fallback', (value, text) => {
            const vm = createVM(program, { memory: { state: value } });
            const branch = expectSay(vm.init(), text);
            expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'After match', speaker: null } });
        });

        it.each<Record<string, string> | undefined>([
            undefined,
            {},
            { state: 'unknown' },
            { state: 'READY' }
        ])('falls back for missing or unmatched memory %j', memory => {
            const vm = createVM(program, { memory });
            expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'After match', speaker: null } });
        });

        it('accepts zero as a case target', () => {
            const vm = createVM({ instructions: [
                { op: 'CHOICE', choices: [{ text: 'Check again', target: 1 }] },
                { op: 'MATCH', on: 'state', cases: { ready: 0 }, fallback: 2 },
                { op: 'END' }
            ] }, { memory: { state: 'ready' } });

            const choice = expectChoice(vm.init(), null, ['Check again']);
            expectChoice(choice.resume(0), null, ['Check again']);
        });

        it.each(['set', 'delete'] as const)('reads memory after %s while paused at a choice', action => {
            const vm = createVM({ instructions: [
                { op: 'CHOICE', choices: [{ text: 'Go', target: 1 }] },
                { op: 'MATCH', on: 'state', cases: { ready: 2 }, fallback: 4 },
                { op: 'SAY', text: 'Ready' },
                { op: 'END' },
                { op: 'SAY', text: 'Fallback' },
                { op: 'END' }
            ] }, { memory: { state: 'ready' } });

            const choice = expectChoice(vm.init(), null, ['Go']);
            if (action === 'set') vm.memory.set('state', 'unknown');
            else vm.memory.delete('state');

            expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });

        it.each(['toString', 'constructor', '__proto__'])('falls back for undeclared prototype name %s in compiled programs', value => {
            const compiled = build(`[match:state]
                = ready
                    Ready
            [/match]
            Fallback`);

            const vm = createVM(compiled, { memory: { state: value } });
            expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });

        it.each(['toString', 'constructor', '__proto__'])('executes a declared prototype-name case %s in compiled programs', value => {
            const compiled = build(`[match:state]
                = ${value}
                    Matched
            [/match]
            Fallback`);

            const vm = createVM(compiled, { memory: { state: value } });
            const branch = expectSay(vm.init(), 'Matched');
            expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });
    });
});
