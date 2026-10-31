/// <reference types="@bunnarray/vite/client" />

import program from './story.bny';
import source from './story.bny?raw';
import { createVM, type BnyEmission, type BnyProgram, type BnyPause } from '@bunnarray/vm';

// These assignments also check the published import declarations with tsc.
export const story: BnyProgram = program;
export const rawSource: string = source;

export function run() {
    const emissions: BnyEmission[] = [];
    const pauses: BnyPause[] = [];
    const vm = createVM(story, {
        onEmission: emission => emissions.push(emission),
        onPause: pause => pauses.push(pause)
    });
    vm.start();
    return { pauses, emissions };
}
