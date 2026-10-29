import {
    type DialogueAST,
    DialogueLexer,
    DialogueParser,
    preprocess,
    DialogueVisitor,
    lower,
    formatLexErrors,
    formatParseErrors
} from '@bunnarray/compiler';

const parser = new DialogueParser();
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

    console.log('lex', lex);

    parser.input = lex.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        console.error(formatParseErrors(parser.errors, normalized));
        return null;
    }

    console.log('cst', cst);

    const ast = visitor.visit(cst) as DialogueAST;

    console.log('ast', ast);

    const ir = lower(ast);

    console.log(ir);

    const end = performance.now();
    console.log(`𑣲₍ ᐢ. .ᐢ₎ : Compiled in ${end - begin}ms!`);

    return {
        ir,
        ast,
        cst,
        lex
    };
}
