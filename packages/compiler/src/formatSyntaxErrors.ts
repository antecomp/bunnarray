import type { ILexingError, IRecognitionException } from 'chevrotain';
import { formatDiagnostics, getLexDiagnostics, getParseDiagnostics } from './syntaxDiagnostics';

export function formatLexErrors(errors: ILexingError[], source: string): string {
    return formatDiagnostics(getLexDiagnostics(errors, source));
}

export function formatParseErrors(errors: IRecognitionException[], source: string): string {
    return formatDiagnostics(getParseDiagnostics(errors, source));
}
