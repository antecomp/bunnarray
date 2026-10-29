import { describe, expect, it } from 'vitest';
import { highlightBNY } from '../highlightBNY';

describe('BNY highlighting', () => {
    it('escapes HTML in dialogue and highlighted syntax', () => {
        expect(highlightBNY('<img src=x onerror=alert(1)> &amp;\n# <script>'))
            .toBe('&lt;img src=x onerror=alert(1)&gt; <span class="bny-escape">&amp;amp;</span>\n<span class="bny-comment"># &lt;script&gt;</span>');
    });

    it('keeps syntax inside comments and literal tags together', () => {
        expect(highlightBNY('# :SET $name {\n[when:name=$literal]'))
            .toBe('<span class="bny-comment"># :SET $name {</span>\n<span class="bny-keyword">[when:name=$literal]</span>');
    });

    it('preserves source whitespace and text escapes across highlighting', () => {
        const source = '\n:SET name=Rabbit\n|Alice| Hello, $name &lbrace; {\n    ?: [id:garden] Go\n        ->end\n}\n@end\n';
        const restored = highlightBNY(source)
            .replace(/<\/?span\b[^>]*>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        expect(restored).toBe(source);
    });
});
