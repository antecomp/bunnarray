// npx tsx packages/compiler/src/language/generate-cst-types.ts

import { writeFileSync } from 'node:fs';
import { generateCstDts } from 'chevrotain';
import parser from './parser.ts';

writeFileSync(
    new URL('./bunnarray-cst.d.ts', import.meta.url),
    generateCstDts(parser.getGAstProductions()),
    'utf8'
);
