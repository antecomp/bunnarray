import { DialogueAST } from './language/ast';
import { DialogueLexer } from './language/lexer';
import parser from './language/parser';
import preprocess from './language/preprocess';
import { DialogueVisitor } from './language/vistor';
import type { Program } from '@bunnarray/vm';
import { lower } from './lower';
import { formatLexErrors, formatParseErrors } from './formatSyntaxErrors';

const visitor = new DialogueVisitor();

export function build(raw: string): Program {
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
    return program;
}
