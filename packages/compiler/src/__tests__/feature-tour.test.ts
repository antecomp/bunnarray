import { describe, expect, it } from 'vitest';
import { createVM, type Emission, type Pause } from '@bunnarray/vm';
import { build } from '../index';
import source from '../../../../examples/feature-tour.bny?raw';

function play(picks: string[]): { emissions: Emission[]; pauses: Pause[] } {
    const emissions: Emission[] = [];
    const pauses: Pause[] = [];
    const vm = createVM(build(source), {
        onEmission: emission => emissions.push(emission),
        onPause: pause => pauses.push(pause)
    });
    let selection = 0;
    vm.start();
    let pause = pauses[pauses.length - 1];

    for (let steps = 0; pause.kind !== 'end' && steps < 150; steps++) {
        if (pause.kind === 'select') {
            const id = picks[selection++];
            const index = pause.options.findIndex(option => option.id === id);
            if (index < 0) throw new Error(`Option ${id} is unavailable`);
            pause.resume(index);
        } else pause.resume();
        pause = pauses[pauses.length - 1];
    }

    expect(pause.kind).toBe('end');
    expect(selection).toBe(picks.length);
    return { emissions, pauses };
}

describe('feature tour example', () => {
    it('runs nested, chained, conditional, yielded, and skipped paths', () => {
        const { emissions, pauses } = play([
            'card_ada', 'look_close', 'music_box', 'waltz',
            'gear', 'paper', 'locked_stair', 'attic', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('The key and the stair route reveal a hidden constellation.');
        expect(spoken).toContain('The ledger names Ada as today\'s explorer.');
        expect(spoken).toContain('The temporary mark is now [].');
        expect(pauses).toContainEqual({ kind: 'yield', identifier: 'reveal_routes', value: 'gallery', resume: expect.any(Function) });
        expect(emissions).toContainEqual({ kind: 'signal', identifier: 'attic_entered', value: undefined });
        expect(pauses.filter(pause => pause.kind === 'select')).toHaveLength(9);
    });

    it('runs the no-key path through a bare nested choice and the bridge', () => {
        const { emissions, pauses } = play([
            'card_bo', 'walk_past', 'telescope', 'near',
            'map', 'ribbon', 'bridge', 'pause', 'stay', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('The rabbit waves at Bo.');
        expect(spoken).toContain('The bridge sways under Bo.');
        expect(spoken).not.toContain('Only curious visitors see this hidden room.');
        expect(pauses.filter(pause => pause.kind === 'select')).toHaveLength(10);
    });

    it('runs a branch in an option and the backward replay goto', () => {
        const { emissions } = play([
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
        const { emissions } = play([
            'card_bo', 'walk_past', 'sealed_drawer',
            'gear', 'paper', 'lift', 'stay', 'finish'
        ]);
        const spoken = emissions.filter(emission => emission.kind === 'say')
            .map(emission => emission.text);

        expect(spoken).toContain('Without a key, we leave it sealed.');
        expect(spoken).toContain('The lift ticket unlocks an upper shelf.');
    });
});
