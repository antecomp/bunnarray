import { describe, expect, it } from 'vitest';
import { createVM, type BnyEmission, type BnyInstruction, type BnyPause, type BnyPauseBody } from '../index';

function runtime(instructions: BnyInstruction[], initialMemory?: Record<string, string>) {
    const emissions: BnyEmission[] = [];
    const pauses: BnyPause[] = [];
    const vm = createVM({ version: { major: 1, minor: 0 }, instructions }, {
        memory: initialMemory,
        onEmission: emission => emissions.push(emission),
        onPause: pause => pauses.push(pause)
    });
    function pause<K extends BnyPause['kind']>(kind: K): BnyPauseBody<K> {
        const latest = pauses[pauses.length - 1];
        expect(latest?.kind).toBe(kind);
        return latest as BnyPauseBody<K>;
    }
    return { vm, emissions, pauses, pause };
}

function say(text: string, speaker: string | null = null): BnyEmission {
    return { kind: 'say', text, speaker };
}

describe('VM', () => {
    it('stops infinite loops when the instruction budget is exceeded', () => {
        const { vm } = runtime([{ op: 'JUMP', target: 0 }, { op: 'END' }]);
        expect(() => vm.start()).toThrow('Instruction budget (100000) exceeded at pc 0');
    });

    it.each([100_000, 100_001])('enforces the instruction budget for a program of %i instructions', count => {
        const instructions: BnyInstruction[] = Array.from({ length: count - 1 }, () => ({
            op: 'SPEAKER', value: null
        }));
        instructions.push({ op: 'END' });
        const { vm, pause } = runtime(instructions);
        if (count === 100_000) {
            vm.start();
            pause('end');
        } else expect(() => vm.start()).toThrow('Instruction budget (100000) exceeded at pc 100000');
    });

    it('resets the instruction budget when execution resumes', () => {
        const instructions: BnyInstruction[] = Array.from({ length: 60_000 }, () => ({
            op: 'SPEAKER', value: null
        }));
        instructions.push({ op: 'YIELD', identifier: 'pause' }, { op: 'JUMP', target: 0 }, { op: 'END' });
        const { vm, pause } = runtime(instructions);
        vm.start();
        pause('yield');
        pause('yield').resume();
        pause('yield');
        pause('yield').resume();
        pause('yield');
    });

    it('synchronously resumes many yields without overflowing the stack (needs a trampoline)', () => {
        const count = 20_000;
        const instructions: BnyInstruction[] = Array.from({ length: count }, () => ({
            op: 'YIELD', identifier: 'automatic'
        }));
        instructions.push({ op: 'END' });
        let resumed = 0;
        let ended = false;
        const vm = createVM({ version: { major: 1, minor: 0 }, instructions }, {
            onEmission: () => {},
            onPause: pause => {
                if (pause.kind === 'yield') {
                    resumed++;
                    // A host may complete a yield immediately (e.g. an already-cached asset).
                    // Calling run() recursively for each resume grows the JavaScript stack.
                    pause.resume();
                } else if (pause.kind === 'end') ended = true;
            }
        });

        // Intentionally red until the VM drives synchronous resumes through a trampoline.
        expect(() => vm.start()).not.toThrow();
        expect(resumed).toBe(count);
        expect(ended).toBe(true);
    });

    it.each<{ instructions: BnyInstruction[] }>([
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

    it.each<BnyInstruction>([
        { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: 'yes' }, target: 2 }], fallback: 1 },
        { op: 'BRANCH', cases: [], fallback: 2 },
        { op: 'CHOICE', choices: [], fallback: 2 }
    ])('rejects out-of-range branch and choice fallbacks: %j', instruction => {
        const { vm } = runtime([instruction, { op: 'END' }], { state: 'yes' });
        expect(() => vm.start()).toThrow('pc (2) out of program range!');
    });

    it('rejects an out-of-range selected choice target', () => {
        const { vm, pause } = runtime([
            { op: 'CHOICE', choices: [{ text: 'Invalid', target: 2 }], fallback: 1 },
            { op: 'END' }
        ]);
        vm.start();
        pause('select');
        expect(() => pause('select').resume(0)).toThrow('pc (2) out of program range!');
    });

    it('ends an empty program and only starts once', () => {
        const { vm, emissions, pauses, pause } = runtime([{ op: 'END' }]);
        expect(pauses).toEqual([]);
        expect(vm.start()).toBeUndefined();
        expect(pause('end')).toEqual({ kind: 'end' });
        expect(pauses).toHaveLength(1);
        expect(emissions).toEqual([]);
        expect(() => vm.start()).toThrow('VM already started');
    });

    it('emits consecutive lines once, pausing before each following line', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SAY', text: 'First' },
            { op: 'SAY', text: 'Second' },
            { op: 'SAY', text: 'Third' },
            { op: 'END' }
        ]);
        vm.start();
        pause('next');
        expect(emissions).toEqual([say('First')]);
        pause('next').resume();
        pause('next');
        expect(emissions).toEqual([say('First'), say('Second')]);
        pause('next').resume();
        pause('end');
        expect(emissions).toEqual([say('First'), say('Second'), say('Third')]);
    });

    it('jumps past skipped instructions', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'JUMP', target: 2 },
            { op: 'SAY', text: 'Skipped' },
            { op: 'SAY', text: 'Reached' },
            { op: 'END' }
        ]);
        vm.start();
        pause('end');
        expect(emissions).toEqual([say('Reached')]);
    });

    it('emits signals without pausing and defers side effects after yields', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SIGNAL', identifier: 'opened' },
            { op: 'YIELD', identifier: 'action', value: 'front & back' },
            { op: 'SET', identifier: 'done', value: 'yes' },
            { op: 'SIGNAL', identifier: 'closed', value: 'done' },
            { op: 'END' }
        ]);
        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'action', value: 'front & back', resume: expect.any(Function) });
        expect(emissions).toEqual([{ kind: 'signal', identifier: 'opened', value: undefined }]);
        expect(vm.memory.get('done')).toBeUndefined();
        pause('yield').resume();
        pause('end');
        expect(vm.memory.get('done')).toBe('yes');
        expect(emissions[emissions.length - 1]).toMatchObject({ kind: 'signal', identifier: 'closed', value: 'done' });
    });

    it('resumes consecutive yields without allowing the next line automatically', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SAY', text: 'Before' },
            { op: 'YIELD', identifier: 'first' },
            { op: 'YIELD', identifier: 'second' },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'first', value: undefined, resume: expect.any(Function) });
        pause('yield').resume();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'second', value: undefined, resume: expect.any(Function) });
        pause('yield').resume();
        pause('next');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before')]);
        pause('next').resume();
        pause('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before'), say('After')]);
    });

    it('allows the first line after a leading yield', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'YIELD', identifier: 'action' },
            { op: 'SAY', text: 'Hello' },
            { op: 'END' }
        ]);
        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'action', value: undefined, resume: expect.any(Function) });
        pause('yield').resume();
        pause('end');
        expect(emissions[0]).toEqual(say('Hello'));
    });

    it.each([0, 1])('follows visible choice %i and rejoins after the branch', index => {
        const { vm, emissions, pause } = runtime([
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
        vm.start();
        expect(pause('select')).toEqual({ kind: 'select', options: [
            { text: 'Left', id: 'left' },
            { text: 'Right', id: undefined }
        ], resume: expect.any(Function) });
        expect(emissions).toEqual([say('Pick one')]);
        expect(() => pause('select').resume(2)).toThrow('Invalid choice index: 2');
        pause('select').resume(index);
        pause('next');
        expect(emissions[1]).toEqual(say(index === 0 ? 'Left branch' : 'Right branch'));
        pause('next').resume();
        pause('end');
        expect(emissions[emissions.length - 1]).toEqual(say('After'));
    });

    it('evaluates choice conditions after resuming a yield', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SAY', text: 'Question' },
            { op: 'YIELD', identifier: 'inspect' },
            { op: 'CHOICE', choices: [
                { text: 'Unlock', target: 3, condition: { identifier: 'key', value: 'yes' } }
            ], fallback: 5 },
            { op: 'SAY', text: 'Opened' },
            { op: 'JUMP', target: 5 },
            { op: 'END' }
        ]);
        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined, resume: expect.any(Function) });
        vm.memory.set('key', 'yes');
        pause('yield').resume();
        expect(pause('select')).toEqual({ kind: 'select', options: [{ text: 'Unlock', id: undefined }], resume: expect.any(Function) });
        expect(emissions[emissions.length - 1]).toEqual({ kind: 'memory', key: 'key', prev: undefined, value: 'yes' });
        pause('select').resume(0);
        pause('end');
        expect(emissions[emissions.length - 1]).toEqual(say('Opened'));
    });

    it('skips empty choices without emitting an option list or repeating the prompt', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SAY', text: 'Question' },
            { op: 'CHOICE', choices: [
                { text: 'Hidden', target: 2, condition: { identifier: 'hidden', value: 'yes' } }
            ], fallback: 4 },
            { op: 'SAY', text: 'Unreachable' },
            { op: 'JUMP', target: 4 },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        vm.start();
        pause('next');
        expect(emissions).toEqual([say('Question')]);
        pause('next').resume();
        pause('end');
        expect(emissions).toEqual([say('Question'), say('After')]);
    });

    it.each(['next', 'yield', 'select'] as const)('consumes each %s resume callback once', kind => {
        const instructions: BnyInstruction[] = kind === 'next'
            ? [{ op: 'SAY', text: 'First' }, { op: 'SAY', text: 'Second' }]
            : kind === 'yield'
                ? [{ op: 'YIELD', identifier: 'pause' }]
                : [{ op: 'CHOICE', choices: [{ text: 'Continue', target: 1 }], fallback: 1 }];
        const { vm, pause } = runtime([...instructions, { op: 'END' }]);
        vm.start();
        // Retain the callback: the latest pause changes when it is consumed.
        const current = pause(kind);
        const resume = () => {
            if (current.kind === 'select') current.resume(0);
            else current.resume();
        };
        resume();
        pause('end');
        expect(resume).toThrow('Callback already consumed');
    });

    it('interpolates memory, stores interpolated values, and deletes values', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'SET', identifier: 'greeting', value: 'Hello $name' },
            { op: 'SAY', text: '$greeting $missing' },
            { op: 'SET', identifier: 'name', value: null },
            { op: 'END' }
        ], { name: 'Rabbit' });
        vm.start();
        pause('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'greeting', prev: undefined, value: 'Hello Rabbit' },
            say('Hello Rabbit '),
            { kind: 'memory', key: 'name', prev: 'Rabbit', value: undefined }
        ]);
        expect(vm.memory.get('greeting')).toBe('Hello Rabbit');
        expect(vm.memory.get('name')).toBeUndefined();
    });

    it('emits host memory writes and deletions after applying them', () => {
        const emissions: BnyEmission[] = [];
        const vm = createVM({ version: { major: 1, minor: 0 }, instructions: [{ op: 'END' }] }, {
            memory: { key: 'initial' },
            onPause: () => {},
            onEmission: emission => {
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

    it.each<BnyInstruction>([
        { op: 'SPEAKER', value: 'Captain $name$missing' },
        { op: 'ALTERNATE', speakers: ['Captain $name$missing'] }
    ])('interpolates speakers using current memory for each line: %j', instruction => {
        const { vm, emissions, pause } = runtime([
            instruction,
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'END' }
        ], { name: 'Alice' });
        vm.start();
        pause('next');
        vm.memory.set('name', 'Bob');
        pause('next').resume();
        pause('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([
            say('One', 'Captain Alice'), say('Two', 'Captain Bob')
        ]);
    });

    it('interpolates alternating speakers while preserving narration and single-pass expansion', () => {
        const { vm, emissions, pauses, pause } = runtime([
            { op: 'ALTERNATE', speakers: ['$name', null, '$missing'] },
            { op: 'SAY', text: 'One' },
            { op: 'SAY', text: 'Two' },
            { op: 'SAY', text: 'Three' },
            { op: 'ALTERNATE', speakers: [] },
            { op: 'SAY', text: 'Four' },
            { op: 'END' }
        ], { name: '$other', other: 'Alice' });
        vm.start();
        while (pauses[pauses.length - 1].kind === 'next') pause('next').resume();
        pause('end');
        expect(emissions).toEqual([
            say('One', '$other'), say('Two'), say('Three', ''), say('Four', '')
        ]);
    });

    it('rotates speakers and stops rotation when a speaker is set', () => {
        const { vm, emissions, pauses, pause } = runtime([
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
        vm.start();
        while (pauses[pauses.length - 1].kind === 'next') pause('next').resume();
        pause('end');
        expect(emissions).toEqual([
            say('One', 'Alice'), say('Two', 'Bob'), say('Three'), say('Four', 'Alice'),
            say('Five', 'Carol'), say('Six')
        ]);
    });

    it.each([
        [{ first: 'yes', second: 'yes' }, 'First'],
        [{ first: 'no', second: 'yes' }, 'Second'],
        [{ first: 'no', second: 'no' }, 'Fallback']
    ] as const)('runs the first matching branch for %j', (memory, text) => {
        const { vm, emissions, pause } = runtime([
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
        vm.start();
        pause('end');
        expect(emissions).toEqual([say(text)]);
    });

    it('matches empty memory values in instructions', () => {
        const { vm, emissions, pause } = runtime([
            { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: '' }, target: 1 }], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ], { state: '' });
        vm.start();
        pause('end');
        expect(emissions).toEqual([say('Matched')]);
    });

    it.each(['toString', 'constructor', '__proto__'])('matches literal branch value %j', value => {
        const { vm, emissions, pause } = runtime([
            { op: 'BRANCH', cases: [
                { condition: { identifier: 'state', value }, target: 1 }
            ], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ], { state: value });
        vm.start();
        pause('end');
        expect(emissions).toEqual([say('Matched')]);
    });
});
