/// <reference types="@bunnarray/vite/client" />

import program from './story.bny';
import source from './story.bny?raw';
import { createVM, type Emission, type Program } from '@bunnarray/vm';

// These assignments also check the published import declarations with tsc.
export const story: Program = program;
export const rawSource: string = source;

export function run() {
    const emissions: Emission[] = [];
    const vm = createVM(story, { handler: emission => emissions.push(emission) });
    const wait = vm.start();
    return { wait, emissions };
}
