import { describe, expect, it } from 'vitest';
import { createVM, type Emission, type Instruction, type VM } from '../index';

function runtime(instructions: Instruction[], initialMemory?: Record<string, string>): { vm: VM; emissions: Emission[] } {
    const emissions: Emission[] = [];
    const vm = createVM({ version: { major: 1, minor: 0 }, instructions }, {
        memory: initialMemory,
        handler: emission => emissions.push(emission)
    });
    return { vm, emissions };
}

function say(text: string, speaker: string | null = null): Emission {
    return { kind: 'say', text, speaker };
}

describe('VM', () => {
    it('ends an empty program and only starts once', () => {
        const { vm, emissions } = runtime([{ op: 'END' }]);
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([{ kind: 'end' }]);
        expect(() => vm.start()).toThrow('VM already started');
    });

    it('emits consecutive lines once, pausing before each following line', () => {
        const { vm, emissions } = runtime([
            { op: 'SAY', text: 'First' },
            { op: 'SAY', text: 'Second' },
            { op: 'SAY', text: 'Third' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('next');
        expect(emissions).toEqual([say('First')]);
        expect(vm.next()).toBe('next');
        expect(emissions).toEqual([say('First'), say('Second')]);
        expect(vm.next()).toBe('end');
        expect(emissions).toEqual([say('First'), say('Second'), say('Third'), { kind: 'end' }]);
    });

    it('jumps past skipped instructions', () => {
        const { vm, emissions } = runtime([
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Reached'), { kind: 'end' }]);
    });

    it('emits signals without pausing and defers side effects after yields', () => {
        const { vm, emissions } = runtime([
            { op: 'SIGNAL', identifier: 'opened' },
            { op: 'YIELD', identifier: 'action', value: 'front & back' },
            { op: 'SET', identifier: 'done', value: 'yes' },
            { op: 'SIGNAL', identifier: 'closed', value: 'done' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('yield');
        expect(emissions).toMatchObject([
            { kind: 'signal', identifier: 'opened', value: undefined },
            { kind: 'yield', identifier: 'action', value: 'front & back' }
        ]);
        expect(vm.memory.get('done')).toBeUndefined();
        expect(vm.resume()).toBe('end');
        expect(vm.memory.get('done')).toBe('yes');
        expect(emissions[emissions.length - 2]).toMatchObject({ kind: 'signal', identifier: 'closed', value: 'done' });
    });

    it('resumes consecutive yields without allowing the next line automatically', () => {
        const { vm, emissions } = runtime([
            { op: 'SAY', text: 'Before' },
            { op: 'YIELD', identifier: 'first' },
            { op: 'YIELD', identifier: 'second' },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('yield');
        expect(vm.resume()).toBe('yield');
        expect(vm.resume()).toBe('next');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before')]);
        expect(vm.next()).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before'), say('After')]);
    });

    it('allows the first line after a leading yield', () => {
        const { vm, emissions } = runtime([
            { op: 'YIELD', identifier: 'action' },
            { op: 'SAY', text: 'Hello' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('yield');
        expect(vm.resume()).toBe('end');
        expect(emissions[1]).toEqual(say('Hello'));
    });

    it.each([0, 1])('follows visible choice %i and rejoins after the branch', index => {
        const { vm, emissions } = runtime([
            { op: 'SAY', text: 'Pick one' },
            { op: 'CHOICE', choices: [
                { text: 'Hidden', target: 2, id: 'hidden', condition: { identifier: 'hidden', value: 'yes' } },
                { text: 'Left', target: 4, id: 'left' },
                { text: 'Right', target: 6 }
            ], fallback: 8 },
            { op: 'SAY', text: 'Unreachable' },
            { op: 'JUMP', target: 8 },
            { op: 'SAY', text: 'Left branch' },
            { op: 'JUMP', target: 8 },
            { op: 'SAY', text: 'Right branch' },
            { op: 'JUMP', target: 8 },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('select');
        expect(emissions).toEqual([say('Pick one'), { kind: 'options', options: [
            { text: 'Left', id: 'left' },
            { text: 'Right' }
        ] }]);
        expect(() => vm.choose(2)).toThrow('Invalid choice index: 2');
        expect(vm.choose(index)).toBe('next');
        expect(emissions[2]).toEqual(say(index === 0 ? 'Left branch' : 'Right branch'));
        expect(vm.next()).toBe('end');
        expect(emissions.slice(-2)).toEqual([say('After'), { kind: 'end' }]);
    });

    it('evaluates choice conditions after resuming a yield', () => {
        const { vm, emissions } = runtime([
            { op: 'SAY', text: 'Question' },
            { op: 'YIELD', identifier: 'inspect' },
            { op: 'CHOICE', choices: [
                { text: 'Unlock', target: 3, condition: { identifier: 'key', value: 'yes' } }
            ], fallback: 5 },
            { op: 'SAY', text: 'Opened' },
            { op: 'JUMP', target: 5 },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('yield');
        vm.memory.set('key', 'yes');
        expect(vm.resume()).toBe('select');
        expect(emissions[emissions.length - 1]).toEqual({ kind: 'options', options: [{ text: 'Unlock' }] });
        expect(vm.choose(0)).toBe('end');
        expect(emissions[emissions.length - 2]).toEqual(say('Opened'));
    });

    it('skips empty choices without emitting an option list or repeating the prompt', () => {
        const { vm, emissions } = runtime([
            { op: 'SAY', text: 'Question' },
            { op: 'CHOICE', choices: [
                { text: 'Hidden', target: 2, condition: { identifier: 'hidden', value: 'yes' } }
            ], fallback: 4 },
            { op: 'SAY', text: 'Unreachable' },
            { op: 'JUMP', target: 4 },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        expect(vm.start()).toBe('next');
        expect(emissions).toEqual([say('Question')]);
        expect(vm.next()).toBe('end');
        expect(emissions).toEqual([say('Question'), say('After'), { kind: 'end' }]);
    });

    it('rejects actions at the wrong pause and after ending', () => {
        const { vm } = runtime([
            { op: 'SAY', text: 'First' },
            { op: 'SAY', text: 'Second' },
            { op: 'END' }
        ]);
        expect(() => vm.next()).toThrow('not paused');
        expect(() => vm.choose(0)).toThrow('not paused');
        expect(() => vm.resume()).toThrow('not paused');
        vm.start();
        expect(() => vm.choose(0)).toThrow("waiting for 'next'");
        expect(() => vm.resume()).toThrow("waiting for 'next'");
        vm.next();
        expect(() => vm.next()).toThrow("waiting for 'end'");
    });

    it('interpolates memory, stores interpolated values, and deletes values', () => {
        const { vm, emissions } = runtime([
            { op: 'SET', identifier: 'greeting', value: 'Hello $name' },
            { op: 'SAY', text: '$greeting $missing' },
            { op: 'SET', identifier: 'name', value: null },
            { op: 'END' }
        ], { name: 'Rabbit' });
        expect(vm.start()).toBe('end');
        expect(emissions[0]).toEqual(say('Hello Rabbit '));
        expect(vm.memory.get('greeting')).toBe('Hello Rabbit');
        expect(vm.memory.get('name')).toBeUndefined();
    });

    it('keeps memory subscriptions working for changes and deletions', () => {
        const { vm } = runtime([{ op: 'END' }]);
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

    it('rotates speakers and stops rotation when a speaker is set', () => {
        const { vm, emissions } = runtime([
            { op: 'ALTERNATE', speakers: ['Alice', 'Bob', null] },
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'SAY', text: 'Three' },
            { op: 'SAY', text: 'Four' },
            { op: 'SPEAKER', value: 'Carol' },
            { op: 'SAY', text: 'Five' },
            { op: 'SPEAKER', value: null },
            { op: 'SAY', text: 'Six' },
            { op: 'END' }
        ]);
        let wait = vm.start();
        while (wait === 'next') wait = vm.next();
        expect(emissions).toEqual([
            say('One', 'Alice'), say('Two', 'Bob'), say('Three'), say('Four', 'Alice'),
            say('Five', 'Carol'), say('Six'), { kind: 'end' }
        ]);
    });

    it.each([
        [{ first: 'yes', second: 'yes' }, 'First'],
        [{ first: 'no', second: 'yes' }, 'Second'],
        [{ first: 'no', second: 'no' }, 'Fallback']
    ] as const)('runs the first matching branch for %j', (memory, text) => {
        const { vm, emissions } = runtime([
            { op: 'BRANCH', cases: [
                { condition: { identifier: 'first', value: 'yes' }, target: 1 },
                { condition: { identifier: 'second', value: 'yes' }, target: 3 }
            ], fallback: 5 },
            { op: 'SAY', text: 'First' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'Second' },
            { op: 'JUMP', target: 6 },
            { op: 'SAY', text: 'Fallback' },
            { op: 'END' }
        ], memory);
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say(text), { kind: 'end' }]);
    });

    it('matches empty memory values in instructions', () => {
        const emissions: Emission[] = [];
        const vm = createVM({ version: { major: 1, minor: 0 }, instructions: [
            { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: '' }, target: 1 }], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ] }, { memory: { state: '' }, handler: emission => emissions.push(emission) });
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Matched'), { kind: 'end' }]);
    });

    it.each(['toString', 'constructor', '__proto__'])('matches literal branch value %j', value => {
        const { vm, emissions } = runtime([
            { op: 'BRANCH', cases: [
                { condition: { identifier: 'state', value }, target: 1 }
            ], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ], { state: value });
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Matched'), { kind: 'end' }]);
    });
});
