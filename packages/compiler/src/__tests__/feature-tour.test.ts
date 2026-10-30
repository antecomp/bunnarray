import { describe, expect, it } from 'vitest';
import { createVM, type Emission } from '@bunnarray/vm';
import { build } from '../index';
import source from '../../../../examples/feature-tour.bny?raw';

function play(picks: string[]): Emission[] {
    const emissions: Emission[] = [];
    const vm = createVM(build(source), { handler: emission => emissions.push(emission) });
    let wait = vm.start();
    let selection = 0;

    for (let steps = 0; wait !== 'end' && steps < 150; steps++) {
        if (wait === 'next') wait = vm.next();
        else if (wait === 'yield') wait = vm.resume();
        else {
            const options = emissions[emissions.length - 1];
            if (options?.kind !== 'options') throw new Error('Expected options');
            const id = picks[selection++];
            const index = options.options.findIndex(option => option.id === id);
            if (index < 0) throw new Error(`Option ${id} is unavailable`);
            wait = vm.choose(index);
        }
    }

    expect(wait).toBe('end');
    expect(selection).toBe(picks.length);
    return emissions;
}

describe('feature tour example', () => {
    it('runs nested, chained, conditional, yielded, and skipped paths', () => {
        const emissions = play([
            'card_ada', 'look_close', 'music_box', 'waltz',
            'gear', 'paper', 'locked_stair', 'attic', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('The key and the stair route reveal a hidden constellation.');
        expect(spoken).toContain('The ledger names Ada as today\'s explorer.');
        expect(spoken).toContain('The temporary mark is now [].');
        expect(emissions).toContainEqual({ kind: 'yield', identifier: 'reveal_routes', value: 'gallery' });
        expect(emissions).toContainEqual({ kind: 'signal', identifier: 'attic_entered', value: undefined });
        expect(emissions.filter(emission => emission.kind === 'options')).toHaveLength(9);
    });

    it('runs the no-key path through a bare nested choice and the bridge', () => {
        const emissions = play([
            'card_bo', 'walk_past', 'telescope', 'near',
            'map', 'ribbon', 'bridge', 'pause', 'stay', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('The rabbit waves at Bo.');
        expect(spoken).toContain('The bridge sways under Bo.');
        expect(spoken).not.toContain('Only curious visitors see this hidden room.');
        expect(emissions.filter(emission => emission.kind === 'options')).toHaveLength(10);
    });

    it('runs a branch in an option and the backward replay goto', () => {
        const emissions = play([
            'card_ada', 'ask_guide', 'sealed_drawer',
            'map', 'ribbon', 'lift', 'stay', 'again', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('The brass key fits.');
        expect(spoken).not.toContain('The lift ticket unlocks an upper shelf.');
        expect(spoken).toContain('The observatory clock strikes once.');
        expect(spoken.filter(text => text === 'Shall we check the clock once more?')).toHaveLength(2);
        expect(spoken).toContain('We continue past the closed exhibit without selecting anything.');
    });

    it('reaches the lift case when the key is missing', () => {
        const emissions = play([
            'card_bo', 'walk_past', 'sealed_drawer',
            'gear', 'paper', 'lift', 'stay', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('Without a key, we leave it sealed.');
        expect(spoken).toContain('The lift ticket unlocks an upper shelf.');
    });
});
