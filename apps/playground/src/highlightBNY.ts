// Match comments first so syntax inside them stays a comment. Dialogue is plain text.
const syntax = /(?<comment>#[^\n]*)|(?<keyword>^[ \t]*:(?:SET|SPEAKER|ALTERNATE|SIGNAL|YIELD)\b|^[ \t]*\?:|\[(?:\/?branch|\/skip)\]|\[(?:skip|when|id):[^\]#\n]*\]?|[{}])|(?<reference>^[ \t]*(?:@|->)[^#{}\[\]|\n]*|^[ \t]*\|[^|#\n]*\|)|(?<variable>\$[A-Za-z_][A-Za-z0-9_]*)|(?<escape>&(?:lbrack|rbrack|lbrace|rbrace|hash|pipe|amp);)/gm;

function escapeHTML(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightBNY(source: string): string {
    let html = '';
    let offset = 0;
    for (const match of source.matchAll(syntax)) {
        const kind = Object.keys(match.groups!).find(key => match.groups![key] !== undefined)!;
        html += escapeHTML(source.slice(offset, match.index));
        html += `<span class="bny-${kind}">${escapeHTML(match[0])}</span>`;
        offset = match.index! + match[0].length;
    }
    return html + escapeHTML(source.slice(offset));
}
