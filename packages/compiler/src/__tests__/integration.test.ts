import { describe, expect, it } from 'vitest';
import { createVM, type Emission } from '@bunnarray/vm';
import { build } from '../index';

describe('compiled programs in the VM', () => {
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
