/// <reference types="@bunnarray/vite/client" />

import program from './story.bny';
import source from './story.bny?raw';
import type { Program } from '@bunnarray/vm';

const compiled: Program = program;
const raw: string = source;

// @ts-expect-error Plain .bny imports are programs, not source text.
const wrongText: string = program;
// @ts-expect-error ?raw imports are source text, not programs.
const wrongProgram: Program = source;

void compiled;
void raw;
void wrongText;
void wrongProgram;
