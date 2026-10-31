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
    it('stops infinite loops when the instruction budget is exceeded', () => {
        const { vm } = runtime([{ op: 'JUMP', target: 0 }, { op: 'END' }]);
        expect(() => vm.start()).toThrow('Instruction budget (100000) exceeded at pc 0');
    });

    it.each([100_000, 100_001])('enforces the instruction budget for a program of %i instructions', count => {
        const instructions: Instruction[] = Array.from({ length: count - 1 }, () => ({
            op: 'SPEAKER', value: null
        }));
        instructions.push({ op: 'END' });
        const { vm } = runtime(instructions);
        if (count === 100_000) expect(vm.start().kind).toBe('end');
        else expect(() => vm.start()).toThrow('Instruction budget (100000) exceeded at pc 100000');
    });

    it('resets the instruction budget when execution resumes', () => {
        const instructions: Instruction[] = Array.from({ length: 60_000 }, () => ({
            op: 'SPEAKER', value: null
        }));
        instructions.push({ op: 'YIELD', identifier: 'pause' }, { op: 'JUMP', target: 0 }, { op: 'END' });
        const { vm } = runtime(instructions);
        expect(vm.start().kind).toBe('yield');
        expect(vm.resume().kind).toBe('yield');
        expect(vm.resume().kind).toBe('yield');
    });

    it.each<{ instructions: Instruction[] }>([
        { instructions: [] },
        { instructions: [{ op: 'SAY', text: 'Missing END' }] },
        { instructions: [{ op: 'END' }, { op: 'SAY', text: 'After END' }] }
    ])('rejects programs without a final END: $instructions', ({ instructions }) => {
        expect(() => runtime(instructions)).toThrow('Program must end with an END instruction');
    });

    it.each([-1, 2, 100, 0.5, NaN, Infinity])('rejects invalid jump target %s', target => {
        const { vm } = runtime([{ op: 'JUMP', target }, { op: 'END' }]);
        expect(() => vm.start()).toThrow(`pc (${target}) out of program range!`);
    });

    it.each<Instruction>([
        { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: 'yes' }, target: 2 }], fallback: 1 },
        { op: 'BRANCH', cases: [], fallback: 2 },
        { op: 'CHOICE', choices: [], fallback: 2 }
    ])('rejects out-of-range branch and choice fallbacks: %j', instruction => {
        const { vm } = runtime([instruction, { op: 'END' }], { state: 'yes' });
        expect(() => vm.start()).toThrow('pc (2) out of program range!');
    });

    it('rejects an out-of-range selected choice target', () => {
        const { vm } = runtime([
            { op: 'CHOICE', choices: [{ text: 'Invalid', target: 2 }], fallback: 1 },
            { op: 'END' }
        ]);
        expect(vm.start().kind).toBe('select');
        expect(() => vm.choose(0)).toThrow('pc (2) out of program range!');
    });

    it('ends an empty program and only starts once', () => {
        const { vm, emissions } = runtime([{ op: 'END' }]);
        expect(vm.start().kind).toBe('end');
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
        expect(vm.start().kind).toBe('next');
        expect(emissions).toEqual([say('First')]);
        expect(vm.next().kind).toBe('next');
        expect(emissions).toEqual([say('First'), say('Second')]);
        expect(vm.next().kind).toBe('end');
        expect(emissions).toEqual([say('First'), say('Second'), say('Third'), { kind: 'end' }]);
    });

    it('jumps past skipped instructions', () => {
        const { vm, emissions } = runtime([
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' }
        ]);
        expect(vm.start().kind).toBe('end');
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
        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'action', value: 'front & back' });
        expect(emissions).toEqual([{ kind: 'signal', identifier: 'opened', value: undefined }]);
        expect(vm.memory.get('done')).toBeUndefined();
        expect(vm.resume().kind).toBe('end');
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
        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'first', value: undefined });
        expect(vm.resume()).toEqual({ kind: 'yield', identifier: 'second', value: undefined });
        expect(vm.resume().kind).toBe('next');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before')]);
        expect(vm.next().kind).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before'), say('After')]);
    });

    it('allows the first line after a leading yield', () => {
        const { vm, emissions } = runtime([
            { op: 'YIELD', identifier: 'action' },
            { op: 'SAY', text: 'Hello' },
            { op: 'END' }
        ]);
        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'action', value: undefined });
        expect(vm.resume().kind).toBe('end');
        expect(emissions[0]).toEqual(say('Hello'));
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
        expect(vm.start()).toEqual({ kind: 'select', options: [
            { text: 'Left', id: 'left' },
            { text: 'Right', id: undefined }
        ] });
        expect(emissions).toEqual([say('Pick one')]);
        expect(() => vm.choose(2)).toThrow('Invalid choice index: 2');
        expect(vm.choose(index).kind).toBe('next');
        expect(emissions[1]).toEqual(say(index === 0 ? 'Left branch' : 'Right branch'));
        expect(vm.next().kind).toBe('end');
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
        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined });
        vm.memory.set('key', 'yes');
        expect(vm.resume()).toEqual({ kind: 'select', options: [{ text: 'Unlock', id: undefined }] });
        expect(emissions[emissions.length - 1]).toEqual({ kind: 'memory', key: 'key', prev: undefined, value: 'yes' });
        expect(vm.choose(0).kind).toBe('end');
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
        expect(vm.start().kind).toBe('next');
        expect(emissions).toEqual([say('Question')]);
        expect(vm.next().kind).toBe('end');
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
        expect(vm.start().kind).toBe('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'greeting', prev: undefined, value: 'Hello Rabbit' },
            say('Hello Rabbit '),
            { kind: 'memory', key: 'name', prev: 'Rabbit', value: undefined },
            { kind: 'end' }
        ]);
        expect(vm.memory.get('greeting')).toBe('Hello Rabbit');
        expect(vm.memory.get('name')).toBeUndefined();
    });

    it('emits host memory writes and deletions after applying them', () => {
        const emissions: Emission[] = [];
        const vm = createVM({ version: { major: 1, minor: 0 }, instructions: [{ op: 'END' }] }, {
            memory: { key: 'initial' },
            handler: emission => {
                if (emission.kind === 'memory') {
                    expect(vm.memory.get(emission.key)).toBe(emission.value);
                }
                emissions.push(emission);
            }
        });
        expect(emissions).toEqual([]);
        vm.memory.set('key', 'value');
        vm.memory.set('key', 'value');
        expect(vm.memory.delete('key')).toBe(true);
        expect(vm.memory.delete('key')).toBe(false);
        vm.memory.set('key', '');
        expect(vm.memory.snapshot()).toEqual({ key: '' });
        expect(emissions).toEqual([
            { kind: 'memory', key: 'key', prev: 'initial', value: 'value' },
            { kind: 'memory', key: 'key', prev: 'value', value: 'value' },
            { kind: 'memory', key: 'key', prev: 'value', value: undefined },
            { kind: 'memory', key: 'key', prev: undefined, value: '' }
        ]);
    });

    it.each<Instruction>([
        { op: 'SPEAKER', value: 'Captain $name$missing' },
        { op: 'ALTERNATE', speakers: ['Captain $name$missing'] }
    ])('interpolates speakers using current memory for each line: %j', instruction => {
        const { vm, emissions } = runtime([
            instruction,
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'END' }
        ], { name: 'Alice' });
        expect(vm.start().kind).toBe('next');
        vm.memory.set('name', 'Bob');
        expect(vm.next().kind).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([
            say('One', 'Captain Alice'), say('Two', 'Captain Bob')
        ]);
    });

    it('interpolates alternating speakers while preserving narration and single-pass expansion', () => {
        const { vm, emissions } = runtime([
            { op: 'ALTERNATE', speakers: ['$name', null, '$missing'] },
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'SAY', text: 'Three' },
            { op: 'ALTERNATE', speakers: [] },
            { op: 'SAY', text: 'Four' },
            { op: 'END' }
        ], { name: '$other', other: 'Alice' });
        let wait = vm.start();
        while (wait.kind === 'next') wait = vm.next();
        expect(emissions).toEqual([
            say('One', '$other'), say('Two'), say('Three', ''), say('Four', ''), { kind: 'end' }
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
        while (wait.kind === 'next') wait = vm.next();
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
        expect(vm.start().kind).toBe('end');
        expect(emissions).toEqual([say(text), { kind: 'end' }]);
    });

    it('matches empty memory values in instructions', () => {
        const emissions: Emission[] = [];
        const vm = createVM({ version: { major: 1, minor: 0 }, instructions: [
            { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: '' }, target: 1 }], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ] }, { memory: { state: '' }, handler: emission => emissions.push(emission) });
        expect(vm.start().kind).toBe('end');
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
        expect(vm.start().kind).toBe('end');
        expect(emissions).toEqual([say('Matched'), { kind: 'end' }]);
    });
});
