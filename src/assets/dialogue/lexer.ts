import { createToken, Lexer } from "chevrotain";

// --- Skipped ---

export const Comment = createToken({
    name: "Comment",
    pattern: /#.*(\n[ \t]*)+/, // comment needs to consume surrounding whitespace and newlines
    group: Lexer.SKIPPED,
});

// Newline consumes blank lines and indentation in one token.
// The parser only ever needs to know "a line break happened here".
export const Newline = createToken({
    name: "Newline",
    pattern: /(\n[ \t]*)+/,
});

// --- Structural tokens ---

export const BlockOpen = createToken({
    name: "BlockOpen",
    pattern: /\{/,
});

export const BlockClose = createToken({
    name: "BlockClose",
    pattern: /\}/,
});

// --- Line-starting tokens ---
// These must come before Text so they win at the start of a line.

export const Option = createToken({
    name: "Option",
    pattern: /\?:\s*/,
});

export const Goto = createToken({
    name: "Goto",
    pattern: /->\s*/,
});

export const Label = createToken({
    name: "Label",
    pattern: /@[ \t]*/ // \t instead to disallow newlines after @
});

export const Equals = createToken({
    name: "Equals",
    pattern: /=\s*/,
});


// General, consume everything else until new line.
export const Text = createToken({
    name: "Text",
    pattern: /[^\n{]+/, // Dont include trailing { for block start.
});

// --- Lexer ---
// Order is priority — first match wins at each position.

export const allTokens = [
    Comment,
    Newline,
    BlockOpen,
    BlockClose,
    Option,
    Goto,
    Label,
    Equals,
    Text,
];

export const DialogueLexer = new Lexer(allTokens);