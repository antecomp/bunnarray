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

function expectYield(
    step: Step,
    identifier: string,
    value?: string,
    presentation: { text: string; speaker: string | null } | null = null
) {
    expect(step).toEqual({ kind: 'yield', presentation, identifier, value, resume: expect.any(Function) });
    if (step.kind !== 'yield') throw new Error('Expected a signal yield');
    return step;
}

describe('VM', () => {
    it('ends an empty program immediately', () => {
        const vm = createVM({ version: 'indev', instructions: [{ op: 'END' }] });
        expect(vm.init()).toEqual({ kind: 'end', presentation: null });
    });

    it('shows the last line before ending', () => {
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'SAY', text: 'Only line' },
            { op: 'END' }
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Only line', speaker: null } });
    });

    it('shows consecutive lines in order, each exactly once', () => {
        const vm = createVM({ version: 'indev', instructions: [
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
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' }
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Reached', speaker: null } });
    });

    it('broadcasts signal identifier/value pairs to subscribers until they unsubscribe', () => {
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'SIGNAL', identifier: 'opened', value: undefined },
            { op: 'CHOICE', choices: [{ text: 'continue', target: 2 }], fallback: 3 },
            { op: 'SIGNAL', identifier: 'closed', value: 'done' },
            { op: 'END' }
        ] });
        const first: unknown[] = [];
        const second: unknown[] = [];
        vm.signals.subscribe(signal => first.push(signal));
        const unsubscribe = vm.signals.subscribe(signal => second.push(signal));

        const choice = expectChoice(vm.init(), null, ['continue']);
        expect(first).toEqual([{ identifier: 'opened', value: undefined }]);
        expect(second).toEqual(first);

        unsubscribe();
        expect(choice.resume(0)).toEqual({ kind: 'end', presentation: null });
        expect(first).toEqual([
            { identifier: 'opened', value: undefined },
            { identifier: 'closed', value: 'done' }
        ]);
        expect(second).toEqual([{ identifier: 'opened', value: undefined }]);
    });

    describe('YIELD', () => {
        it('pauses side effects until resumed without broadcasting the yielded signal', () => {
            const vm = createVM(build(`:YIELD open_door: front &amp; back
                :SET opened=yes
                :SIGNAL opened
            `));
            const signals: unknown[] = [];
            vm.signals.subscribe(signal => signals.push(signal));

            const step = expectYield(vm.init(), 'open_door', 'front & back');
            expect(vm.memory.get('opened')).toBeUndefined();
            expect(signals).toEqual([]);

            expect(step.resume()).toEqual({ kind: 'end', presentation: null });
            expect(vm.memory.get('opened')).toBe('yes');
            expect(signals).toEqual([{ identifier: 'opened', value: undefined }]);
            expect(() => step.resume()).toThrow('Resume callback already consumed');
        });

        it('resumes consecutive yields once each, including a yield immediately before END', () => {
            const vm = createVM(build(':YIELD first\n:YIELD second: done'));

            const first = expectYield(vm.init(), 'first');
            const second = expectYield(first.resume(), 'second', 'done');
            expect(() => first.resume()).toThrow('Resume callback already consumed');
            expect(second.resume()).toEqual({ kind: 'end', presentation: null });
        });

        it('presents the prompt with the yield and delays choices until resuming', () => {
            const program = build(`:SPEAKER Narrator
                The door will not open
                :YIELD inspect_door
                {
                    ?: [when:has_key=yes] Use key
                        Opened
                }
            `);
            const paused = createVM(program);
            const step = expectYield(paused.init(), 'inspect_door', undefined, {
                text: 'The door will not open', speaker: 'Narrator'
            });
            paused.memory.set('has_key', 'yes');

            const choice = expectChoice(step.resume(), null, ['Use key']);
            expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Opened', speaker: 'Narrator' } });
        });

        it('presents the queued line with the yield before the next prompt and choices', () => {
            const vm = createVM(build(`Outside
                You enter
                :YIELD open_door
                Inside {
                    ?: Continue
                        Done
                }
            `));

            const outside = expectSay(vm.init(), 'Outside');
            const action = expectYield(outside.resume(), 'open_door', undefined, {
                text: 'You enter', speaker: null
            });
            const choice = expectChoice(action.resume(), 'Inside', ['Continue']);
            expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Done', speaker: null } });
        });

        it('consumes pending text only once across consecutive yields and END', () => {
            const vm = createVM(build('Hello\n:YIELD first\n:YIELD second'));

            const first = expectYield(vm.init(), 'first', undefined, { text: 'Hello', speaker: null });
            const second = expectYield(first.resume(), 'second');
            expect(second.resume()).toEqual({ kind: 'end', presentation: null });
        });

        it('does not repeat the yielded presentation when all following choices are hidden', () => {
            const vm = createVM(build(`Question
                :YIELD inspect
                {
                    ?: [when:available=yes] Hidden
                        Unreachable
                }
                After
            `));

            const step = expectYield(vm.init(), 'inspect', undefined, { text: 'Question', speaker: null });
            expect(step.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
        });
    });

    it('keeps memory subscriptions working for changes and deletions', () => {
        const vm = createVM({ version: 'indev', instructions: [{ op: 'END' }] });
        const updates: unknown[] = [];
        const unsubscribe = vm.memory.subscribe(update => updates.push(update));

        vm.memory.set('key', 'value');
        vm.memory.delete('key');
        unsubscribe();
        vm.memory.set('key', 'later');

        expect(updates).toEqual([
            { key: 'key', prev: undefined, value: 'value' },
            { key: 'key', prev: 'value', value: undefined }
        ]);
    });

    it.each([
        [0, 'Left'],
        [1, 'Right']
    ])('follows choice %i and rejoins after its branch', (index, branchText) => {
        const program: Program = { version: 'indev', instructions: [
            { op: 'SAY', text: 'Pick one' },
            { op: 'CHOICE', choices: [
                { text: 'left', target: 2 },
                { text: 'right', target: 4 }
            ], fallback: 6 },
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
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }], fallback: 2 },
            { op: 'SAY', text: 'Going' },
            { op: 'END' }
        ] });

        const choice = expectChoice(vm.init(), null, ['go']);
        expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Going', speaker: null } });
    });

    it.each([
        [0, 'Open path'],
        [1, 'Always path']
    ])('maps visible choice %i to its original branch after filtering', (index, text) => {
        const program = build(`Pick one {
            ?: [when:locked=no] Hidden
                Hidden path
            ?: [when:open=yes] Open
                Open path
            ?: Always
                Always path
        }
        After`);
        const vm = createVM(program, { memory: { locked: 'yes', open: 'yes' } });
        const choice = expectChoice(vm.init(), 'Pick one', ['Open', 'Always']);

        // The displayed list is a snapshot; changing memory does not remap its indices.
        vm.memory.set('open', 'no');
        const selected = expectSay(choice.resume(index), text);
        expect(selected.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
    });

    it('checks option conditions when the choice is reached', () => {
        const vm = createVM(build(`Start
            Pick one {
                ?: [when:state=ready] Ready
                    Ready path
            }
            After`));
        const start = expectSay(vm.init(), 'Start');
        vm.memory.set('state', 'ready');
        const choice = expectChoice(start.resume(), 'Pick one', ['Ready']);
        const selected = expectSay(choice.resume(0), 'Ready path');
        expect(selected.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
    });

    it('falls through without yielding an empty choice list', () => {
        const prompted = createVM(build(`Question {
            ?: [when:state=ready] Ready
                Ready path
        }
        After`));
        const question = expectSay(prompted.init(), 'Question');
        expect(question.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });

        const bare = createVM(build(`{
            ?: [when:state=ready] Ready
                Ready path
        }
        After`));
        expect(bare.init()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
    });

    it('does not reuse a hidden choice prompt for the next choice', () => {
        const vm = createVM(build(`First question? {
            ?: [when:state=ready] Hidden
                Hidden path
        }
        {
            ?: Continue
                Continued
        }`));

        const prompt = expectSay(vm.init(), 'First question?');
        const choice = expectChoice(prompt.resume(), null, ['Continue']);
        expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Continued', speaker: null } });
    });

    it('rejects repeated initialization and repeated resumes', () => {
        const vm = createVM({ version: 'indev', instructions: [
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
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }], fallback: 1 },
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

    describe('BRANCH', () => {
        it('matches an empty memory value and falls through for missing memory', () => {
            const program: Program = { version: 'indev', instructions: [
                { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: '' }, target: 1 }], fallback: 3 },
                { op: 'SAY', text: 'Empty value' },
                { op: 'JUMP', target: 3 },
                { op: 'SAY', text: 'After' },
                { op: 'END' }
            ] };

            const matched = expectSay(createVM(program, { memory: { state: '' } }).init(), 'Empty value');
            expect(matched.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
            expect(createVM(program).init()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
        });

        it('accepts zero as a case target', () => {
            const vm = createVM({ version: 'indev', instructions: [
                { op: 'CHOICE', choices: [{ text: 'Check again', target: 1 }], fallback: 2 },
                { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: 'ready' }, target: 0 }], fallback: 2 },
                { op: 'END' }
            ] }, { memory: { state: 'ready' } });

            const choice = expectChoice(vm.init(), null, ['Check again']);
            expectChoice(choice.resume(0), null, ['Check again']);
        });

        it.each(['toString', 'constructor', '__proto__'])('falls through for undeclared prototype name %s', value => {
            const compiled = build(`[branch]
                [when:state=ready]
                    Ready
            [/branch]
            Fallback`);

            const vm = createVM(compiled, { memory: { state: value } });
            expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });

        it.each(['toString', 'constructor', '__proto__'])('executes a declared prototype-name case %s', value => {
            const compiled = build(`[branch]
                [when:state=${value}]
                    Matched
            [/branch]
            Fallback`);

            const vm = createVM(compiled, { memory: { state: value } });
            const branch = expectSay(vm.init(), 'Matched');
            expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });

        const program = build(`[branch]
            [when:first=yes]
                First
            [when:second=yes]
                Second
        [/branch]
        After`);

        it.each([
            { name: 'first when both match', memory: { first: 'yes', second: 'yes' }, text: 'First' },
            { name: 'later when the first fails', memory: { first: 'no', second: 'yes' }, text: 'Second' }
        ])('executes the $name and rejoins after the block', ({ memory, text }) => {
            const vm = createVM(program, { memory });
            const branch = expectSay(vm.init(), text);
            expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
        });

        it.each<Record<string, string>>([
            {},
            { first: 'no', second: 'no' }
        ])('falls through when no condition matches: %j', memory => {
            const vm = createVM(program, { memory });
            expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });
        });

        it.each(['set', 'delete'] as const)('reads memory after %s while paused at a choice', action => {
            const vm = createVM({ version: 'indev', instructions: [
                { op: 'CHOICE', choices: [{ text: 'Go', target: 1 }], fallback: 6 },
                { op: 'BRANCH', cases: [
                    { condition: { identifier: 'state', value: 'ready' }, target: 2 }
                ], fallback: 4 },
                { op: 'SAY', text: 'Ready' },
                { op: 'END' },
                { op: 'SAY', text: 'Fallback' },
                { op: 'END' }
            ] }, { memory: { state: 'ready' } });

            const choice = expectChoice(vm.init(), null, ['Go']);
            if (action === 'set') vm.memory.set('state', 'waiting');
            else vm.memory.delete('state');
            expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Fallback', speaker: null } });
        });

        it('returns from nested branches and lets a goto bypass the fallback', () => {
            const nested = build(`[branch]
                [when:outer=yes]
                    [branch]
                        [when:inner=yes]
                            Both
                    [/branch]
                    Outer
                [when:jump=yes]
                    ->done
            [/branch]
            After
            ->end
            @done
            Done
            @end`);

            const vm = createVM(nested, { memory: { outer: 'yes', inner: 'yes' } });
            const both = expectSay(vm.init(), 'Both');
            const outer = expectSay(both.resume(), 'Outer');
            expect(outer.resume()).toEqual({ kind: 'end', presentation: { text: 'After', speaker: null } });

            const jumped = createVM(nested, { memory: { jump: 'yes' } });
            expect(jumped.init()).toEqual({ kind: 'end', presentation: { text: 'Done', speaker: null } });
        });
    });
});
