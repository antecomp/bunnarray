import {
    type DialogueAST,
    DialogueLexer,
    preprocess,
    DialogueVisitor,
    lower,
    formatLexErrors,
    formatParseErrors,
    parser
} from '@bunnarray/compiler';

const visitor = new DialogueVisitor();

export function buildDebug(raw: string) {
    const begin = performance.now();
    console.log('𑣲₍ ᐢ. .ᐢ₎ : Compiling .bny dialogue...');

    const normalized = preprocess(raw);
    const lex = DialogueLexer.tokenize(normalized);
    
    if (lex.errors.length > 0) {
        console.error(formatLexErrors(lex.errors, normalized));
        return null;
    }

    parser.input = lex.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        console.error(formatParseErrors(parser.errors, normalized));
        return null;
    }

    const ast = visitor.visit(cst) as DialogueAST;

    const ir = lower(ast);

    const end = performance.now();
    console.log(`𑣲₍ ᐢ. .ᐢ₎ : Compiled in ${end - begin}ms!`);

    return {
        ir,
        ast,
        cst,
        lex
    };
}
