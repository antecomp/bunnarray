import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { Registry, parseRawGrammar, INITIAL, type IGrammar } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { build } from '../build';

const extension = new URL('../../../../tools/vscode-bny/', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, extension), 'utf8');
let grammar: IGrammar;

beforeAll(async () => {
    const require = createRequire(import.meta.url);
    await loadWASM(readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
    const registry = new Registry({
        onigLib: Promise.resolve({
            createOnigScanner: patterns => new OnigScanner(patterns),
            createOnigString: text => new OnigString(text)
        }),
        loadGrammar: async () => parseRawGrammar(read('syntaxes/bny.tmLanguage.json'), 'bny.json')
    });
    grammar = (await registry.loadGrammar('source.bny'))!;
});

function scopes(line: string, text: string) {
    const offset = line.indexOf(text);
    expect(offset).toBeGreaterThanOrEqual(0);
    return grammar.tokenizeLine(line, INITIAL).tokens.find(token =>
        token.startIndex <= offset && token.endIndex > offset
    )!.scopes;
}

describe('VS Code syntax highlighting', () => {
    it('recognizes inline comments after syntax and dialogue', () => {
        for (const line of ['Hello # note', '@label # note', '->label # note', '[branch] # note', '[skip:label] # note', '?: Answer # note', ':SET name=value # note']) {
            expect(scopes(line, '# note')).toContain('comment.line.number-sign.bny');
        }
    });

    it('highlights supported directives and speaker shorthand', () => {
        for (const directive of [':SET name=value', ':SET name', ':SPEAKER Alice', ':SPEAKER', ':ALTERNATE Alice; Bob', ':ALTERNATE']) {
            expect(scopes(directive, directive.split(' ')[0])).toContain('keyword.other.directive.bny');
        }
        for (const directive of [':SIGNAL event', ':YIELD action:value']) {
            expect(scopes(directive, directive.split(' ')[0])).toContain('keyword.control.directive.bny');
        }
        expect(scopes('|Bob Smith| Hello, $name!', 'Bob')).toContain('entity.name.speaker.bny');
        expect(scopes('|| Narrator', '||')).toContain('punctuation.definition.speaker.begin.bny');
        expect(scopes('|Bob| Hello, $name!', '$name')).toContain('variable.other.bny');
    });

    it('highlights option metadata in either order', () => {
        for (const line of ['?: [when:key=yes] [id:door] Open', '?: [id:door] [when:key=yes] Open']) {
            expect(scopes(line, 'when')).toContain('keyword.control.branch-case.bny');
            expect(scopes(line, 'key')).toContain('variable.other.bny');
            expect(scopes(line, 'door')).toContain('entity.name.option.bny');
        }
        expect(scopes('[when: key = yes] # case', 'yes')).toContain('constant.other.branch-value.bny');
    });

    it('limits interpolation to dialogue and SET values', () => {
        for (const line of ['Hello $name', ':SET greeting=Hello $name']) {
            expect(scopes(line, '$name')).toContain('variable.other.bny');
        }
        for (const line of ['?: $name', '?: [id:$name] Answer', '[when:key=$name]', ':SIGNAL event:$name', ':YIELD action:$name', ':SPEAKER $name', ':ALTERNATE $name; Bob', '|$name| Hello', '@$name', '->$name']) {
            expect(scopes(line, '$name')).not.toContain('variable.other.bny');
        }
    });

    it('highlights text escapes without interpreting escaped delimiters', () => {
        for (const escape of ['lbrack', 'rbrack', 'lbrace', 'rbrace', 'hash', 'pipe', 'amp']) {
            for (const line of [`Hello &${escape};`, `?: &${escape};`, `:SET text=&${escape};`, `|&${escape};| Hello`]) {
                expect(scopes(line, `&${escape};`)).toContain('constant.character.escape.bny');
            }
        }
    });

    it('treats legacy angle tags as dialogue and ends option scope at the newline', () => {
        expect(scopes('<signal:keygiven>', 'signal')).toEqual(['source.bny']);
        const option = grammar.tokenizeLine('?: An option', INITIAL);
        const next = grammar.tokenizeLine('Hello $name', option.ruleStack);
        expect(next.tokens.some(token => token.scopes.includes('variable.other.bny'))).toBe(true);
        expect(next.tokens.every(token => !token.scopes.includes('meta.option.bny'))).toBe(true);
    });
});

describe('VS Code authoring support', () => {
    it('expands snippets into compilable current syntax', () => {
        const snippets = JSON.parse(read('snippets.json')) as Record<string, { body: string[] }>;
        for (const [name, snippet] of Object.entries(snippets)) {
            let source = snippet.body.join('\n').replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\d+/g, '');
            if (name === 'Conditional Option' || name === 'Option ID') source = `{\n${name === 'Option ID' ? '?: ' : ''}${source}${name === 'Option ID' ? ' Answer' : ''}\n}`;
            if (name === 'Branch Case') source = `[branch]\n${source}\n[/branch]`;
            if (name === 'Goto') source = `@label\n${source}`;
            expect(() => build(source), name).not.toThrow();
        }
    });

    it('pairs current structural brackets without auto-closing legacy tags', () => {
        const config = JSON.parse(read('language-configuration.json'));
        expect(config.brackets).toEqual([['{', '}'], ['[', ']']]);
        expect(config.autoClosingPairs.map((pair: { open: string }) => pair.open)).toEqual(['{', '[']);
    });
});
