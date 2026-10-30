import type { ILexingError, IRecognitionException } from 'chevrotain';

/**
 * A normalized compiler syntax diagnostic produced by the lexer or parser.
 */
export interface SyntaxDiagnostic {
    kind: 'lex' | 'parse';
    message: string;
    line: number;
    column: number;
    offset: number;
}

function getLocation(source: string, offset: number, line?: number, column?: number) {
    const locationOffset = Number.isFinite(offset) ? offset : source.length;
    if (line !== undefined && column !== undefined && Number.isFinite(line) && Number.isFinite(column)) {
        return { offset: locationOffset, line, column };
    }

    // Chevrotain's EOF token has no finite location, so locate the end of input.
    const lines = source.slice(0, locationOffset).split('\n');
    return { offset: locationOffset, line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * Converts lexical analysis errors into normalized compiler diagnostics.
 */
export function getLexDiagnostics(errors: ILexingError[], source: string): SyntaxDiagnostic[] {
    return errors.map(error => ({
        kind: 'lex',
        message: error.message,
        ...getLocation(source, error.offset, error.line, error.column)
    }));
}

/**
 * Converts parser recognition errors into normalized compiler diagnostics.
 */
export function getParseDiagnostics(errors: IRecognitionException[], source: string): SyntaxDiagnostic[] {
    return errors.map(error => ({
        kind: 'parse',
        message: error.message,
        ...getLocation(source, error.token.startOffset, error.token.startLine, error.token.startColumn)
    }));
}

/**
 * Formats one or more syntax diagnostics into a readable multi-line compiler error message.
 */
export function formatDiagnostics(diagnostics: SyntaxDiagnostic[]): string {
    return diagnostics.map(({ kind, line, column, message }) =>
        `${kind === 'lex' ? 'Lex' : 'Parse'} error at line ${line}, column ${column}: ${message}`
    ).join('\n');
}

/**
 * Error raised when the BunNarraY compiler encounters one or more syntax issues.
 * The original diagnostics remain attached for callers that need structured error details.
 */
export class CompilerSyntaxError extends SyntaxError {
    readonly diagnostics: SyntaxDiagnostic[];

    /**
     * Creates a syntax error from a batch of normalized diagnostics.
     */
    constructor(diagnostics: SyntaxDiagnostic[]) {
        super(formatDiagnostics(diagnostics));
        this.name = 'CompilerSyntaxError';
        this.diagnostics = diagnostics;
    }
}
