import { DialogueAST } from './language/ast';
import { DialogueLexer } from './language/lexer';
import parser from './language/parser';
import visitor from './language/visitor';
import preprocess from './language/preprocess';
import type { BnyProgram } from '@bunnarray/vm';
import { lower } from './lower';
import { CompilerSyntaxError, getLexDiagnostics, getParseDiagnostics } from './syntaxDiagnostics';

/**
 * Compiles raw BunNarraY dialogue source into a program.
 *
 * @throws a {@link CompilerSyntaxError} when lexing or parsing fails.
 *
 * @param raw Raw dialogue source.
 * @returns The compiled VM program.
 */
export function build(raw: string): BnyProgram {
    const normalized = preprocess(raw);
    const lex = DialogueLexer.tokenize(normalized);

    if (lex.errors.length > 0) {
        throw new CompilerSyntaxError(getLexDiagnostics(lex.errors, normalized));
    }

    parser.input = lex.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        throw new CompilerSyntaxError(getParseDiagnostics(parser.errors, normalized));
    }

    const ast = visitor.visit(cst) as DialogueAST;

    const program = lower(ast);
    return program;
}
