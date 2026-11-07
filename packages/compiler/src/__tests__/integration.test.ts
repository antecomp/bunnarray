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
            :SET x=$missing
            [branch]
                [when:x]
                    Empty
            [/branch]
            :SET x
            [branch]
                [when:x]
                    Hidden
            [/branch]
            After`), {
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
