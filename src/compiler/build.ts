import { DialogueAST } from '../language/ast';
import { DialogueLexer } from '../language/lexer';
import { DialogueParser } from '../language/parser';
import preprocess from '../language/preprocess';
import { DialogueVisitor } from '../language/vistor';
import { Program } from './instructions';
import lower from './lower';
import { formatLexErrors, formatParseErrors } from './formatSyntaxErrors';

const parser = new DialogueParser();
const visitor = new DialogueVisitor();

export default function build(raw: string): Program {
    const begin = performance.now();
    console.log('𑣲₍ ᐢ. .ᐢ₎ : Compiling .bny dialogue...');

    const normalized = preprocess(raw);
    const lex = DialogueLexer.tokenize(normalized);

    if (lex.errors.length > 0) {
        throw new Error(formatLexErrors(lex.errors, normalized));
    }

    parser.input = lex.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        throw new Error(formatParseErrors(parser.errors, normalized));
    }

    const ast = visitor.visit(cst) as DialogueAST;

    const program = lower(ast);

    const end = performance.now();
    console.log(`𑣲₍ ᐢ. .ᐢ₎ : Compiled in ${end - begin}ms!`);

    return program;
}
