import { describe, expect, it } from 'vitest';
import build from '../../compiler/build';
import createVM, { type Emission } from '../vm';

function runtime(source: string, memory?: Record<string, string>) {
    const emissions: Emission[] = [];
    const vm = createVM(build(source), { memory, handler: emission => emissions.push(emission) });
    return { vm, emissions };
}

function say(text: string, speaker: string | null = null): Emission {
    return { kind: 'say', text, speaker };
}

describe('VM', () => {
    it('ends an empty program and only starts once', () => {
        const { vm, emissions } = runtime('');
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([{ kind: 'end' }]);
        expect(() => vm.start()).toThrow('Resume callback already consumed');
    });

    it('emits consecutive lines once, pausing before each following line', () => {
        const { vm, emissions } = runtime('First\nSecond\nThird');
        expect(vm.start()).toBe('next');
        expect(emissions).toEqual([say('First')]);
        expect(vm.next()).toBe('next');
        expect(emissions).toEqual([say('First'), say('Second')]);
        expect(vm.next()).toBe('end');
        expect(emissions).toEqual([say('First'), say('Second'), say('Third'), { kind: 'end' }]);
    });

    it('jumps past skipped instructions', () => {
        const { vm, emissions } = runtime('->done\nSkipped\n@done\nReached');
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Reached'), { kind: 'end' }]);
    });

    it('emits signals without pausing and defers side effects after yields', () => {
        const { vm, emissions } = runtime(':SIGNAL opened\n:YIELD action: front &amp; back\n:SET done=yes\n:SIGNAL closed: done');
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
        const { vm, emissions } = runtime('Before\n:YIELD first\n:YIELD second\nAfter');
        expect(vm.start()).toBe('yield');
        expect(vm.resume()).toBe('yield');
        expect(vm.resume()).toBe('next');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before')]);
        expect(vm.next()).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([say('Before'), say('After')]);
    });

    it('allows the first line after a leading yield', () => {
        const { vm, emissions } = runtime(':YIELD action\nHello');
        expect(vm.start()).toBe('yield');
        expect(vm.resume()).toBe('end');
        expect(emissions[1]).toEqual(say('Hello'));
    });

    it.each([0, 1])('follows visible choice %i and rejoins after the branch', index => {
        const { vm, emissions } = runtime(`Pick one {
            ?: [when:hidden=yes] Hidden
                Unreachable
            ?: Left
                Left branch
            ?: Right
                Right branch
        }
        After`);
        expect(vm.start()).toBe('select');
        expect(emissions).toEqual([say('Pick one'), { kind: 'options', options: ['Left', 'Right'] }]);
        expect(() => vm.choose(2)).toThrow('Invalid choice index: 2');
        expect(vm.choose(index)).toBe('next');
        expect(emissions[2]).toEqual(say(index === 0 ? 'Left branch' : 'Right branch'));
        expect(vm.next()).toBe('end');
        expect(emissions.slice(-2)).toEqual([say('After'), { kind: 'end' }]);
    });

    it('evaluates choice conditions after resuming a yield', () => {
        const { vm, emissions } = runtime(`Question
            :YIELD inspect
            {
                ?: [when:key=yes] Unlock
                    Opened
            }`);
        expect(vm.start()).toBe('yield');
        vm.memory.set('key', 'yes');
        expect(vm.resume()).toBe('select');
        expect(emissions[emissions.length - 1]).toEqual({ kind: 'options', options: ['Unlock'] });
        expect(vm.choose(0)).toBe('end');
        expect(emissions[emissions.length - 2]).toEqual(say('Opened'));
    });

    it('skips empty choices without emitting an option list or repeating the prompt', () => {
        const { vm, emissions } = runtime(`Question {
            ?: [when:hidden=yes] Hidden
                Unreachable
        }
        After`);
        expect(vm.start()).toBe('next');
        expect(emissions).toEqual([say('Question')]);
        expect(vm.next()).toBe('end');
        expect(emissions).toEqual([say('Question'), say('After'), { kind: 'end' }]);
    });

    it('rejects actions at the wrong pause and after ending', () => {
        const { vm } = runtime('First\nSecond');
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
        const { vm, emissions } = runtime(':SET greeting=Hello $name\n$greeting $missing\n:SET name', { name: 'Rabbit' });
        expect(vm.start()).toBe('end');
        expect(emissions[0]).toEqual(say('Hello Rabbit '));
        expect(vm.memory.get('greeting')).toBe('Hello Rabbit');
        expect(vm.memory.get('name')).toBeUndefined();
    });

    it('keeps memory subscriptions working for changes and deletions', () => {
        const { vm } = runtime('');
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
        const { vm, emissions } = runtime(':ALTERNATE Alice; Bob\nOne\nTwo\nThree\n:SPEAKER Carol\nFour\n:SPEAKER\nFive');
        let wait = vm.start();
        while (wait === 'next') wait = vm.next();
        expect(emissions).toEqual([
            say('One', 'Alice'), say('Two', 'Bob'), say('Three', 'Alice'),
            say('Four', 'Carol'), say('Five'), { kind: 'end' }
        ]);
    });

    it.each([
        [{ first: 'yes', second: 'yes' }, 'First'],
        [{ first: 'no', second: 'yes' }, 'Second'],
        [{ first: 'no', second: 'no' }, 'Fallback']
    ] as const)('runs the first matching branch for %j', (memory, text) => {
        const { vm, emissions } = runtime(`[branch]
            [when:first=yes]
                First
                ->done
            [when:second=yes]
                Second
                ->done
        [/branch]
        Fallback
        @done`, memory);
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say(text), { kind: 'end' }]);
    });

    it('matches empty memory values in compiled instructions', () => {
        const emissions: Emission[] = [];
        const vm = createVM({ version: 'indev', instructions: [
            { op: 'BRANCH', cases: [{ condition: { identifier: 'state', value: '' }, target: 1 }], fallback: 2 },
            { op: 'SAY', text: 'Matched' },
            { op: 'END' }
        ] }, { memory: { state: '' }, handler: emission => emissions.push(emission) });
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Matched'), { kind: 'end' }]);
    });

    it.each(['toString', 'constructor', '__proto__'])('matches literal branch value %j', value => {
        const { vm, emissions } = runtime(`[branch]
            [when:state=${value}]
                Matched
        [/branch]`, { state: value });
        expect(vm.start()).toBe('end');
        expect(emissions).toEqual([say('Matched'), { kind: 'end' }]);
    });
});
