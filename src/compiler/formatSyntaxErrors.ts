import type { ILexingError, IRecognitionException } from 'chevrotain';

function formatLocation(source: string, offset: number, line?: number, column?: number): string {
    if (Number.isFinite(line) && Number.isFinite(column)) {
        return `line ${line}, column ${column}`;
    }

    // Chevrotain's EOF token has no line or column, so locate the end of input.
    const before = source.slice(0, Number.isFinite(offset) ? offset : source.length);
    const lines = before.split('\n');
    return `line ${lines.length}, column ${lines[lines.length - 1].length + 1}`;
}

export function formatLexErrors(errors: ILexingError[], source: string): string {
    return errors.map(error =>
        `Lex error at ${formatLocation(source, error.offset, error.line, error.column)}: ${error.message}`
    ).join('\n');
}

export function formatParseErrors(errors: IRecognitionException[], source: string): string {
    return errors.map(error =>
        `Parse error at ${formatLocation(source, error.token.startOffset,
            error.token.startLine, error.token.startColumn)}: ${error.message}`
    ).join('\n');
}
