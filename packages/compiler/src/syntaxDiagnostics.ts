import type { ILexingError, IRecognitionException } from 'chevrotain';

/** Locations refer to preprocessed input: lines/columns are 1-based, offsets are 0-based. */
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

export function getLexDiagnostics(errors: ILexingError[], source: string): SyntaxDiagnostic[] {
    return errors.map(error => ({
        kind: 'lex',
        message: error.message,
        ...getLocation(source, error.offset, error.line, error.column)
    }));
}

export function getParseDiagnostics(errors: IRecognitionException[], source: string): SyntaxDiagnostic[] {
    return errors.map(error => ({
        kind: 'parse',
        message: error.message,
        ...getLocation(source, error.token.startOffset, error.token.startLine, error.token.startColumn)
    }));
}

export function formatDiagnostics(diagnostics: SyntaxDiagnostic[]): string {
    return diagnostics.map(({ kind, line, column, message }) =>
        `${kind === 'lex' ? 'Lex' : 'Parse'} error at line ${line}, column ${column}: ${message}`
    ).join('\n');
}

export class CompilerSyntaxError extends SyntaxError {
    readonly diagnostics: SyntaxDiagnostic[];

    constructor(diagnostics: SyntaxDiagnostic[]) {
        super(formatDiagnostics(diagnostics));
        this.name = 'CompilerSyntaxError';
        this.diagnostics = diagnostics;
    }
}
