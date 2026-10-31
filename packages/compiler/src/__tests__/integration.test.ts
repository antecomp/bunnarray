import { describe, expect, it } from 'vitest';
import { createVM, type Emission, type Pause, type PauseBody } from '@bunnarray/vm';
import { build } from '../index';

function capture(pauses: Pause[]) {
    return <K extends Pause['kind']>(kind: K): PauseBody<K> => {
        const latest = pauses[pauses.length - 1];
        expect(latest?.kind).toBe(kind);
        return latest as PauseBody<K>;
    };
}

describe('compiled programs in the VM', () => {
    it('persists shorthand speakers through choices and stops speaker rotation', () => {
        const emissions: Emission[] = [];
        const pauses: Pause[] = [];
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

        const emissions: Emission[] = [];
        const pauses: Pause[] = [];
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
        const emissions: Emission[] = [];
        const pauses: Pause[] = [];
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
        const emissions: Emission[] = [];
        const pauses: Pause[] = [];
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
});
