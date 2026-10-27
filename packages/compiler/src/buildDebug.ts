import { DialogueAST } from './language/ast';
import { DialogueLexer } from './language/lexer';
import { DialogueParser } from './language/parser';
import preprocess from './language/preprocess';
import { DialogueVisitor } from './language/vistor';
import { lower } from './lower';
import { formatLexErrors, formatParseErrors } from './formatSyntaxErrors';

const parser = new DialogueParser();
const visitor = new DialogueVisitor();

export function buildDebug(raw: string) {
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

    return {
        ir,
        ast,
        cst,
        lex
    };
}
