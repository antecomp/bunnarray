import { describe, expect, it } from 'vitest';
import { build, CompilerSyntaxError } from '../index';
import type { SyntaxDiagnostic } from '../index';
import { DialogueLexer } from '../language/lexer';
import parser from '../language/parser';
import preprocess from '../language/preprocess';
import { formatDiagnostics, getLexDiagnostics, getParseDiagnostics } from '../syntaxDiagnostics';

describe('syntax diagnostics', () => {
    it('exposes each lexer error as JSON-serializable data while preserving readable formatting', () => {
        const source = ':SET 1bad\n:SET 2bad\n';
        const { errors } = DialogueLexer.tokenize(source);
        const diagnostics: SyntaxDiagnostic[] = getLexDiagnostics(errors, source);

        expect(diagnostics).toEqual([
            { kind: 'lex', message: errors[0].message, line: 1, column: 6, offset: 5 },
            { kind: 'lex', message: errors[1].message, line: 2, column: 6, offset: 15 }
        ]);
        expect(JSON.parse(JSON.stringify(diagnostics))).toEqual(diagnostics);
        expect(formatDiagnostics(diagnostics)).toBe(
            `Lex error at line 1, column 6: ${errors[0].message}\nLex error at line 2, column 6: ${errors[1].message}`
        );
    });

    it.each([
        ['{\n  Plain\n}\n', 2, 3, 4],
        ['{\n  ?: Yes\n', 3, 1, 11]
    ] as const)('exposes parser locations including EOF for %j', (source, line, column, offset) => {
        parser.input = DialogueLexer.tokenize(source).tokens;
        parser.dialogue();
        const diagnostics = getParseDiagnostics(parser.errors, source);

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0]).toEqual({ kind: 'parse', message: parser.errors[0].message, line, column, offset });
        expect(JSON.parse(JSON.stringify(diagnostics))).toEqual(diagnostics);
        expect(formatDiagnostics(diagnostics)).toBe(diagnostics.map(diagnostic =>
            `Parse error at line ${diagnostic.line}, column ${diagnostic.column}: ${diagnostic.message}`
        ).join('\n'));
    });

    it.each([
        [':SET 1bad', 'lex', 1, 6, 5],
        ['Hello\r\n{\r\n  Plain\r\n}', 'parse', 3, 3, 10],
        ['{\n  ?: Yes', 'parse', 3, 1, 11]
    ] as const)('throws structured diagnostics from build for %j', (source, kind, line, column, offset) => {
        let caught: unknown;
        try {
            build(source);
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(CompilerSyntaxError);
        expect(caught).toBeInstanceOf(Error);
        if (!(caught instanceof CompilerSyntaxError)) throw new Error('Expected CompilerSyntaxError');
        expect(caught.name).toBe('CompilerSyntaxError');
        expect(caught.diagnostics[0]).toEqual({ kind, line, column, offset, message: expect.any(String) });
        expect(caught.message).toContain(`error at line ${line}, column ${column}: `);
        expect(offset).toBeLessThanOrEqual(preprocess(source).length);
    });

    it('returns empty diagnostics and formatted strings for empty error lists', () => {
        expect(getLexDiagnostics([], '')).toEqual([]);
        expect(getParseDiagnostics([], '')).toEqual([]);
        expect(formatDiagnostics([])).toBe('');
    });
});
