export type TokenType =
    | 'TEXT'
    | 'OPTION'
    | 'GOTO'
    | 'LABEL'
    | 'BLOCK_OPEN'
    | 'BLOCK_CLOSE'

export type Token =
    | { type: 'TEXT'; text: string }
    | { type: 'OPTION'; text: string }
    | { type: 'GOTO'; label: string }
    | { type: 'LABEL'; label: string }
    | { type: 'BLOCK_OPEN' }
    | { type: 'BLOCK_CLOSE' }

// Tokens can just be by-line. I am not going to bother setting up regex groups.
// A bigol' if chain is good enough for this simple thing.
export default function tokenize(raw: string) {
    const tokens: Token[] = [];

    for (let line of raw.split('\n')) {
        line = line.trim();
        if (!line) continue; // Skip line breaks.

        if(line.startsWith('#')) continue; // Comments.

        if (line === '{') {
            tokens.push({type: 'BLOCK_OPEN'});
        }
        else if(line === '}') {
            tokens.push({type: 'BLOCK_CLOSE'});
        }
        else if(line.startsWith('->')) {
            const label = line.slice(2).trim();
            tokens.push({type: 'GOTO', label});
        }
        else if(line.startsWith('@')) {
            const label = line.slice(1).trim();
            tokens.push({type: 'LABEL', label});
        }
        else if(line.startsWith('?:')) {
            const text = line.slice(2).trim();
            tokens.push({type: 'OPTION', text});
        } else {
            tokens.push({type: 'TEXT', text: line})
        }
    }

    return tokens;
} 