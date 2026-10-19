import { createToken, Lexer } from "chevrotain";

export const Newline = createToken({
    name: 'Newline',
    pattern: /\n/
});

// --- Question Blocks ---

export const CurlyBraceOpen = createToken({
    name: "CurlyBraceOpen",
    pattern: /\{/,
});

export const CurlyBraceClose = createToken({
    name: "CurlyBraceClose",
    pattern: /\}/,
});

export const ChoiceToken = createToken({
    name: "ChoiceToken",
    pattern: /\?:[ \t]*/,
});

// --- Other Blocks ---

export const CloseBracket = createToken({
    name: "CloseBracket",
    pattern: /\]/,
});

export const SkipBlockOpen = createToken({
    name: "SkipBlockOpen",
    pattern: /\[skip:/,
});

export const SkipBlockClose = createToken({
    name: "SkipBlockClose",
    pattern: /\[\/skip\]/,
});

export const MatchBlockOpen = createToken({
    name: "MatchBlockOpen",
    pattern: /\[match:/,
});

export const MatchBlockClose = createToken({
    name: "MatchBlockClose",
    pattern: /\[\/match\]/,
});

// --- Labels & Gotos ---

export const GotoToken = createToken({
    name: "GotoToken",
    pattern: /->[ \t]*/,
});

export const LabelToken = createToken({
    name: "LabelToken",
    pattern: /@[ \t]*/
});

// --- Other junk ---
export const Equals = createToken({
    name: "Equals",
    pattern: /=[ \t]*/,
});


// -- Remaining text ---
// Consumes all characters up excluding \n, [] and {}
export const Text = createToken({
    name: "Text",
    pattern: /[^\n{}\[\]]+/
});



// --- Lexer ---
// Order is priority, first match wins.

export const allTokens = [
    Newline,
    CurlyBraceOpen,
    CurlyBraceClose,
    SkipBlockOpen,
    SkipBlockClose,
    MatchBlockOpen,
    MatchBlockClose,
    ChoiceToken,
    GotoToken,
    LabelToken,
    Equals,
    CloseBracket,
    Text
]

export const DialogueLexer = new Lexer(allTokens);