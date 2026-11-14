import { describe, expect, it } from 'vitest';
import { createVM, type BnyEmission, type BnyPause, type BnyPauseBody } from '@bunnarray/vm';
import { build } from '../index';

function capture(pauses: BnyPause[]) {
    return <K extends BnyPause['kind']>(kind: K): BnyPauseBody<K> => {
        const latest = pauses[pauses.length - 1];
        expect(latest?.kind).toBe(kind);
        return latest as BnyPauseBody<K>;
    };
}

describe('compiled programs in the VM', () => {
    it.each<{ condition: string; memory: Record<string, string>; whenMatches: boolean }>([
        { condition: 'key', memory: {}, whenMatches: false },
        { condition: 'key', memory: { key: '' }, whenMatches: true },
        { condition: 'key', memory: { key: 'yes' }, whenMatches: true },
        { condition: 'key=yes', memory: {}, whenMatches: false },
        { condition: 'key=yes', memory: { key: 'yes' }, whenMatches: true },
        { condition: 'key=yes', memory: { key: 'no' }, whenMatches: false },
        { condition: 'key=$other', memory: {}, whenMatches: true },
        { condition: 'key=$other', memory: { key: 'yes' }, whenMatches: false },
        { condition: 'key=$other', memory: { other: 'yes' }, whenMatches: false },
        { condition: 'key=$other', memory: { key: 'yes', other: 'yes' }, whenMatches: true },
        { condition: 'key=$other', memory: { key: 'no', other: 'yes' }, whenMatches: false }
    ])('uses unless as the exact inverse of when for %j', ({ condition, memory, whenMatches }) => {
        for (const keyword of ['when', 'unless'] as const) {
            const matches = keyword === 'when' ? whenMatches : !whenMatches;
            const emissions: BnyEmission[] = [];
            const pauses: BnyPause[] = [];
            const vm = createVM(build(`[branch]
                [${keyword}:${condition}]
                    Matched
            [/branch]
            {
                ?: [${keyword}:${condition}] Conditional
                ?: Always
            }`), {
                memory,
                onEmission: emission => emissions.push(emission),
                onPause: pause => pauses.push(pause)
            });

            vm.start();
            expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
                .toEqual(matches ? ['Matched'] : []);
            expect(capture(pauses)('select').options.map(option => option.text))
                .toEqual(matches ? ['Conditional', 'Always'] : ['Always']);
        }
    });

    it.each<{ value: string; memory: Record<string, string>; matches: boolean }>([
        { value: '$other', memory: { key: 'yes', other: 'yes' }, matches: true },
        { value: '$other', memory: { key: 'no', other: 'yes' }, matches: false },
        { value: '$other', memory: { key: '', other: '' }, matches: true },
        { value: '$other', memory: { key: '' }, matches: false },
        { value: '$other', memory: {}, matches: true },
        { value: '$other', memory: { other: 'yes' }, matches: false },
        { value: 'Hello $name$ending', memory: { key: 'Hello Alice!', name: 'Alice', ending: '!' }, matches: true },
        { value: 'Hello $name$ending', memory: { key: 'Hello Alice', name: 'Alice' }, matches: false },
        { value: 'Hello $name$ending', memory: { name: 'Alice' }, matches: true },
        { value: '$other', memory: { key: '$third', other: '$third', third: 'expanded' }, matches: true }
    ])('compares expanded when values, including undefined: %j', ({ value, memory, matches }) => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`[branch]
            [when:key=${value}]
                Matched
            [/branch]
            {
                ?: [when:key=${value}] Conditional
                ?: Always
            }`), {
            memory,
            onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause)
        });

        vm.start();
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(matches ? ['Matched'] : []);
        expect(pause('select').options.map(option => option.text))
            .toEqual(matches ? ['Conditional', 'Always'] : ['Always']);
    });

    it('expands when values using memory at the time each condition runs', () => {
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`:YIELD update
            [branch]
                [when:key=$other]
                    :SET other=no
            [/branch]
            {
                ?: [when:key=$other] Conditional
                ?: Always
            }`), {
            memory: { key: 'yes' },
            onEmission: () => {}, onPause: pause => pauses.push(pause)
        });

        vm.start();
        vm.memory.set('other', 'yes');
        pause('yield').resume();
        expect(vm.memory.get('other')).toBe('no');
        expect(pause('select').options.map(option => option.text)).toEqual(['Always']);
    });

    it('skips empty choices and selects an inline nested choice', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build('{}\n{ ?: Continue {} { ?: Done } }\nAfter'), {
            onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause)
        });

        vm.start();
        expect(pause('select').options).toEqual([{ text: 'Continue', id: undefined }]);
        pause('select').resume(0);
        expect(pause('select').options).toEqual([{ text: 'Done', id: undefined }]);
        pause('select').resume(0);
        pause('end');
        expect(pauses.map(pause => pause.kind)).toEqual(['select', 'select', 'end']);
        expect(emissions).toEqual([{ kind: 'say', text: 'After', speaker: null }]);
    });

    it('runs consecutive choice blocks after completing the first option', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`{
            ?: First
                First path
        }
        {
            ?: Second
                Second path
        }
        After`), {
            onEmission: emission => emissions.push(emission),
            onPause: current => pauses.push(current)
        });

        vm.start();
        expect(pause('select').options).toEqual([{ text: 'First', id: undefined }]);
        pause('select').resume(0);
        expect(pause('select').options).toEqual([{ text: 'Second', id: undefined }]);
        pause('select').resume(0);
        pause('next').resume();
        expect(pause('end')).toEqual({ kind: 'end' });
        expect(emissions).toEqual([
            { kind: 'say', text: 'First path', speaker: null },
            { kind: 'say', text: 'Second path', speaker: null },
            { kind: 'say', text: 'After', speaker: null }
        ]);
    });

    it('passes compiled option IDs through to the visible selection and follows its target', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`{
            ?: [when:visible=yes] [id:hidden] Hidden
                Hidden path
            ?: [id:go] Go
                Go path
            ?: Plain
                Plain path
        }`), {
            onEmission: emission => emissions.push(emission),
            onPause: current => pauses.push(current)
        });

        vm.start();
        expect(pause('select').options).toEqual([
            { text: 'Go', id: 'go' },
            { text: 'Plain', id: undefined }
        ]);
        pause('select').resume(0);
        expect(pause('end')).toEqual({ kind: 'end' });
        expect(emissions).toEqual([{ kind: 'say', text: 'Go path', speaker: null }]);
    });

    it('executes forward and backward gotos while skipping and later entering a skip block', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const vm = createVM(build(`->start
            @repeat
            Repeated
            ->done
            @start
            First
            [skip:secret]
                Secret
                ->repeat
            [/skip]
            Skipped
            ->secret
            @done
            End`), {
            onEmission: emission => emissions.push(emission),
            onPause: current => {
                if (current.kind === 'next') current.resume();
                else pauses.push(current);
            }
        });

        vm.start();
        expect(pauses).toEqual([{ kind: 'end' }]);
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(['First', 'Skipped', 'Secret', 'Repeated', 'End']);
    });

    it('persists shorthand speakers through choices and stops speaker rotation', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`:ALTERNATE Alice; Bob
            Hello.
            |Carol| Choose {
                ?: A &pipe; B
                    Still Carol.
            }
            Still Carol too.
            || Narration.`), { onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause) });

        vm.start();
        pause('next');
        pause('next').resume();
        expect(pause('select')).toEqual({ kind: 'select', options: [{ text: 'A | B', id: undefined }], resume: expect.any(Function) });
        pause('select').resume(0);
        pause('next');
        pause('next').resume();
        pause('next');
        pause('next').resume();
        pause('end');
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([
            { kind: 'say', text: 'Hello.', speaker: 'Alice' },
            { kind: 'say', text: 'Choose', speaker: 'Carol' },
            { kind: 'say', text: 'Still Carol.', speaker: 'Carol' },
            { kind: 'say', text: 'Still Carol too.', speaker: 'Carol' },
            { kind: 'say', text: 'Narration.', speaker: null }
        ]);
    });

    it('advances alternating speakers only for spoken lines across signals, yields, sets, and choices', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`:ALTERNATE Alice; Bob
            First
            :SIGNAL ping
            :YIELD wait
            :SET state=ready
            { ?: [id:continue] Continue }
            Second
            :ALTERNATE
            Third`), {
            onEmission: emission => emissions.push(emission),
            onPause: current => pauses.push(current)
        });

        vm.start();
        expect(pause('yield').identifier).toBe('wait');
        pause('yield').resume();
        expect(pause('select').options).toEqual([{ text: 'Continue', id: 'continue' }]);
        pause('select').resume(0);
        pause('next').resume();
        expect(pause('end')).toEqual({ kind: 'end' });
        expect(emissions.filter(emission => emission.kind === 'say')).toEqual([
            { kind: 'say', text: 'First', speaker: 'Alice' },
            { kind: 'say', text: 'Second', speaker: 'Bob' },
            { kind: 'say', text: 'Third', speaker: 'Bob' }
        ]);
        expect(emissions).toContainEqual({ kind: 'signal', identifier: 'ping', value: undefined });
        expect(emissions).toContainEqual({ kind: 'memory', key: 'state', prev: undefined, value: 'ready' });
    });

    it('preserves optional payloads and memory deletion through JSON serialization', () => {
        const program = build(`:SET name=Rabbit
            :SET name
            :SIGNAL opened
            :SIGNAL status:ready
            :YIELD inspect
            :YIELD action:continue
            Name: $name`);
        const restored = JSON.parse(JSON.stringify(program));
        expect(restored).toStrictEqual(program);

        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(restored, { onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause) });
        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined, resume: expect.any(Function) });
        expect(vm.memory.get('name')).toBeUndefined();
        pause('yield').resume();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'action', value: 'continue', resume: expect.any(Function) });
        pause('yield').resume();
        pause('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'name', prev: undefined, value: 'Rabbit' },
            { kind: 'memory', key: 'name', prev: 'Rabbit', value: undefined },
            { kind: 'signal', identifier: 'opened', value: undefined },
            { kind: 'signal', identifier: 'status', value: 'ready' },
            { kind: 'say', text: 'Name: ', speaker: null }
        ]);
    });

    it('runs a compiled choice and rejoins the dialogue', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const program = build(`Choose {
            ?: Left
                Left branch
            ?: Right
                Right branch
        }
        After`);
        const vm = createVM(program, { onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause) });

        vm.start();
        expect(pause('select')).toEqual({ kind: 'select', options: [
            { text: 'Left', id: undefined }, { text: 'Right', id: undefined }
        ], resume: expect.any(Function) });
        pause('select').resume(1);
        pause('next');
        pause('next').resume();
        pause('end');
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(['Choose', 'Right branch', 'After']);
    });

    it('resumes a compiled yield with updated memory', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(':YIELD inspect\n[branch]\n[when:key=yes]\nOpened\n[/branch]'), {
            onEmission: emission => emissions.push(emission), onPause: pause => pauses.push(pause)
        });

        vm.start();
        expect(pause('yield')).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined, resume: expect.any(Function) });
        vm.memory.set('key', 'yes');
        pause('yield').resume();
        pause('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'key', prev: undefined, value: 'yes' },
            { kind: 'say', text: 'Opened', speaker: null }
        ]);
    });

    it('matches a value-free when while memory is set, including an empty value', () => {
        const emissions: BnyEmission[] = [];
        const pauses: BnyPause[] = [];
        const vm = createVM(build(`:SET x=hfjkdfsh
            [branch]
                [when:x]
                    Nonempty
            [/branch]
            :SET x=$empty
            [branch]
                [when:x]
                    Empty
            [/branch]
            :SET x=$missing
            [branch]
                [when:x]
                    Hidden
            [/branch]
            After`), {
            memory: { empty: '' },
            onEmission: emission => emissions.push(emission),
            onPause: pause => {
                if (pause.kind === 'next') pause.resume();
                else pauses.push(pause);
            }
        });

        vm.start();
        expect(pauses[pauses.length - 1]?.kind).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(['Nonempty', 'Empty', 'After']);
    });

    it.each([undefined, '', 'key'])('shows a value-free conditional option for memory value %j', value => {
        const pauses: BnyPause[] = [];
        const pause = capture(pauses);
        const vm = createVM(build(`{
            ?: [when:x] Open
            ?: Always
        }`), { onEmission: () => {}, onPause: next => pauses.push(next) });

        if (value !== undefined) vm.memory.set('x', value);
        vm.start();
        expect(pause('select').options.map(option => option.text))
            .toEqual(value === undefined ? ['Always'] : ['Open', 'Always']);
    });
});
