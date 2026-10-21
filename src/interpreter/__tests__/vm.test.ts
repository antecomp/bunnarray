import { describe, expect, it } from 'vitest';
import type { Program } from '../../compiler/instructions';
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
            { op: 'END' },
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Only line' } });
    });

    it('shows consecutive lines in order, each exactly once', () => {
        const vm = createVM({ instructions: [
            { op: 'SAY', text: 'First' },
            { op: 'SAY', text: 'Second' },
            { op: 'SAY', text: 'Third' },
            { op: 'END' },
        ] });

        const first = expectSay(vm.init(), 'First');
        const second = expectSay(first.resume(), 'Second');
        expect(second.resume()).toEqual({ kind: 'end', presentation: { text: 'Third' } });
    });

    it('jumps to its target without executing the skipped instruction', () => {
        const vm = createVM({ instructions: [
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' },
        ] });

        expect(vm.init()).toEqual({ kind: 'end', presentation: { text: 'Reached' } });
    });

    it.each([
        [0, 'Left'],
        [1, 'Right'],
    ])('follows choice %i and rejoins after its branch', (index, branchText) => {
        const program: Program = { instructions: [
            { op: 'SAY', text: 'Pick one' },
            { op: 'CHOICE', choices: [
                { text: 'left', target: 2 },
                { text: 'right', target: 4 },
            ] },
            { op: 'SAY', text: 'Left' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'Right' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'After choice' },
            { op: 'END' },
        ] };

        const choice = expectChoice(createVM(program).init(), 'Pick one', ['left', 'right']);
        const branch = expectSay(choice.resume(index), branchText);
        expect(branch.resume()).toEqual({ kind: 'end', presentation: { text: 'After choice' } });
    });

    it('supports a choice without a preceding prompt', () => {
        const vm = createVM({ instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }] },
            { op: 'SAY', text: 'Going' },
            { op: 'END' },
        ] });

        const choice = expectChoice(vm.init(), null, ['go']);
        expect(choice.resume(0)).toEqual({ kind: 'end', presentation: { text: 'Going' } });
    });

    it('rejects repeated initialization and repeated resumes', () => {
        const vm = createVM({ instructions: [
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'END' },
        ] });

        const first = expectSay(vm.init(), 'One');
        expect(() => vm.init()).toThrow('Resume callback already consumed');
        expect(first.resume()).toEqual({ kind: 'end', presentation: { text: 'Two' } });
        expect(() => first.resume()).toThrow('Resume callback already consumed');
    });

    it('rejects an invalid choice index and a repeated choice resume', () => {
        const vm = createVM({ instructions: [
            { op: 'CHOICE', choices: [{ text: 'go', target: 1 }] },
            { op: 'END' },
        ] });

        const choice = expectChoice(vm.init(), null, ['go']);
        expect(() => choice.resume(1)).toThrow('Invalid choice index: 1');
        expect(() => choice.resume(0)).toThrow('Resume callback already consumed');
    });

    it('reports MATCH as unsupported until VM memory is implemented', () => {
        // TODO: Replace with case and fallback execution tests when MATCH is supported.
        const vm = createVM({ instructions: [
            { op: 'MATCH', on: 'state', cases: { ready: 1 }, fallback: 2 },
            { op: 'SAY', text: 'Ready' },
            { op: 'END' },
        ] });

        expect(() => vm.init()).toThrow('Match currently unsupported');
    });
});
