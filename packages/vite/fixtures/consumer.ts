/// <reference types="@bunnarray/vite/client" />

import program from './story.bny';
import source from './story.bny?raw';
import { createVM, type Emission, type Program, type Pause } from '@bunnarray/vm';

// These assignments also check the published import declarations with tsc.
export const story: Program = program;
export const rawSource: string = source;

export function run() {
    const emissions: Emission[] = [];
    const pauses: Pause[] = [];
    const vm = createVM(story, {
        onEmission: emission => emissions.push(emission),
        onPause: pause => pauses.push(pause)
    });
    vm.start();
    return { pauses, emissions };
}
