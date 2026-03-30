// .bny dialogue compiler 𑣲₍ ᐢ. .ᐢ₎ 
// made by omni 2026

import { DialogueNode } from "./types";
import { build } from "./builder";
import { resetIdCounter } from "./genid";
import { DialogueLexer } from "./lexer";
import { DialogueParser } from "./parser";
import { flatten } from "./processor";
import { DialogueVisitor } from "./visitor";

const parser = new DialogueParser();
const visitor = new DialogueVisitor();

export function compileBnyDialogue(raw: string, debug = false): DialogueNode | null {
    resetIdCounter();

    const begin = performance.now();
    console.log("𑣲₍ ᐢ. .ᐢ₎ : Compiling .bny dialogue...");

    const lexResult = DialogueLexer.tokenize(raw.trim());
    if (lexResult.errors.length > 0) {
        console.error("Lex errors:", lexResult.errors);
        return null;
    }

    if(debug) console.log('Tokens: ', lexResult);

    parser.input = lexResult.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        console.error("Parse errors:", parser.errors);
        return null;
    }

    if(debug) console.log('CST: ', cst);

    // AST with Chevro info stripped.
    const tree = visitor.visit(cst);

    if(debug) console.log('Visited Tree: ', tree);

    // Large set of nodes referenced by preliminary id
    const flatResult = flatten(tree);

    if(debug) console.log('Flattened IR: ', flatResult)

    // Creates and links actual DialogueNodes
    const built = build(flatResult);

    const end = performance.now();
    console.log(`𑣲₍ ᐢ. .ᐢ₎ : Compiled in ${end - begin}ms!`)

    if(debug) console.log('Final build: ', built);

    return built;
}
