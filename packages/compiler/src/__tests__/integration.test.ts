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

        expect(vm.start()).toBe('next');
        expect(vm.next()).toBe('select');
        expect(emissions[2]).toEqual({ kind: 'options', options: [{ text: 'A | B' }] });
        expect(vm.choose(0)).toBe('next');
        expect(vm.next()).toBe('next');
        expect(vm.next()).toBe('end');
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
        expect(vm.start()).toBe('yield');
        expect(vm.memory.get('name')).toBeUndefined();
        expect(vm.resume()).toBe('yield');
        expect(vm.resume()).toBe('end');
        expect(emissions).toEqual([
            { kind: 'signal', identifier: 'opened', value: undefined },
            { kind: 'signal', identifier: 'status', value: 'ready' },
            { kind: 'yield', identifier: 'inspect', value: undefined },
            { kind: 'yield', identifier: 'action', value: 'continue' },
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

        expect(vm.start()).toBe('select');
        expect(emissions[1]).toEqual({ kind: 'options', options: [{ text: 'Left' }, { text: 'Right' }] });
        expect(vm.choose(1)).toBe('next');
        expect(vm.next()).toBe('end');
        expect(emissions.filter(emission => emission.kind === 'say').map(emission => emission.text))
            .toEqual(['Choose', 'Right branch', 'After']);
    });

    it('resumes a compiled yield with updated memory', () => {
        const emissions: Emission[] = [];
        const vm = createVM(build(':YIELD inspect\n[branch]\n[when:key=yes]\nOpened\n[/branch]'), {
            handler: emission => emissions.push(emission)
        });

        expect(vm.start()).toBe('yield');
        vm.memory.set('key', 'yes');
        expect(vm.resume()).toBe('end');
        expect(emissions).toEqual([
            { kind: 'yield', identifier: 'inspect', value: undefined },
            { kind: 'say', text: 'Opened', speaker: null },
            { kind: 'end' }
        ]);
    });
});
