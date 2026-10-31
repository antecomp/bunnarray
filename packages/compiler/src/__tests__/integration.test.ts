import { describe, expect, it } from 'vitest';
import { createVM, type Emission } from '@bunnarray/vm';
import { build } from '../index';

describe('compiled programs in the VM', () => {
    it('persists shorthand speakers through choices and stops speaker rotation', () => {
        const emissions: Emission[] = [];
        const vm = createVM(build(`:ALTERNATE Alice; Bob
            Hello.
            |Carol| Choose {
                ?: A &pipe; B
                    Still Carol.
            }
            Still Carol too.
            || Narration.`), { handler: emission => emissions.push(emission) });

        expect(vm.start().kind).toBe('next');
        expect(vm.next()).toEqual({ kind: 'select', options: [{ text: 'A | B', id: undefined }] });
        expect(vm.choose(0).kind).toBe('next');
        expect(vm.next().kind).toBe('next');
        expect(vm.next().kind).toBe('end');
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
        const vm = createVM(restored, { handler: emission => emissions.push(emission) });
        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined });
        expect(vm.memory.get('name')).toBeUndefined();
        expect(vm.resume()).toEqual({ kind: 'yield', identifier: 'action', value: 'continue' });
        expect(vm.resume().kind).toBe('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'name', prev: undefined, value: 'Rabbit' },
            { kind: 'memory', key: 'name', prev: 'Rabbit', value: undefined },
            { kind: 'signal', identifier: 'opened', value: undefined },
            { kind: 'signal', identifier: 'status', value: 'ready' },
            { kind: 'say', text: 'Name: ', speaker: null },
            { kind: 'end' }
        ]);
    });

    it('runs a compiled choice and rejoins the dialogue', () => {
        const emissions: Emission[] = [];
        const program = build(`Choose {
            ?: Left
                Left branch
            ?: Right
                Right branch
        }
        After`);
        const vm = createVM(program, { handler: emission => emissions.push(emission) });

        expect(vm.start()).toEqual({ kind: 'select', options: [
            { text: 'Left', id: undefined }, { text: 'Right', id: undefined }
        ] });
        expect(vm.choose(1).kind).toBe('next');
        expect(vm.next().kind).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(['Choose', 'Right branch', 'After']);
    });

    it('resumes a compiled yield with updated memory', () => {
        const emissions: Emission[] = [];
        const vm = createVM(build(':YIELD inspect\n[branch]\n[when:key=yes]\nOpened\n[/branch]'), {
            handler: emission => emissions.push(emission)
        });

        expect(vm.start()).toEqual({ kind: 'yield', identifier: 'inspect', value: undefined });
        vm.memory.set('key', 'yes');
        expect(vm.resume().kind).toBe('end');
        expect(emissions).toEqual([
            { kind: 'memory', key: 'key', prev: undefined, value: 'yes' },
            { kind: 'say', text: 'Opened', speaker: null },
            { kind: 'end' }
        ]);
    });
});
