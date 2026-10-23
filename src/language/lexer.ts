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
// Ignore whitespace between syntax tokens (for example, the gap in `} {`).
// Spaces inside a Text token are consumed by Text and remain part of its image.
export const Whitespace = createToken({
    name: "Whitespace",
    pattern: /[ \t]+/,
    group: Lexer.SKIPPED,
});

// Consumes all characters up excluding \n, [] and {}
export const Text = createToken({
    name: "Text",
    pattern: /[^\n{}\[\]]+/
});


// --- Set Logic ---

export const Identifier = createToken({
    name: 'Identifier',
    pattern: /[a-zA-Z_][a-zA-Z0-9_]*/
});

export const SetKeyword = createToken({
    name: 'SetKeyword',
    pattern: /:SET\b/,
    push_mode: 'setHeader'
});

export const SetEquals = createToken({
    name: 'SetEquals',
    pattern: /=[ \t]*/,
    pop_mode: true,
    push_mode: 'setValue'
});

// TODO: Consider using just Text, so {}, [] isn't magically usable in these contexts...
export const SetValue = createToken({
    name: "SetValue",
    pattern: /[^\n]+/
});

export const SetNewline = createToken({
    name: "SetNewline",
    pattern: /\n/,
    pop_mode: true
});


// --- Speaker Logic ---
export const SpeakerKeyword = createToken({
    name: 'SpeakerKeyword',
    pattern: /:SPEAKER\b/
});


// --- Lexer ---
// Order is priority, first match wins.

const normalTokens = [
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
    SetKeyword,
    SpeakerKeyword,
    Equals,
    CloseBracket,
    Whitespace,
    Text,
];

export const allTokens = [
    ...normalTokens,
    Identifier,
    SetEquals,
    SetValue,
    SetNewline,
];

export const DialogueLexer = new Lexer({
    defaultMode: "normal",
    modes: {
        normal: normalTokens,
        setHeader: [Whitespace, Identifier, SetEquals, SetNewline],
        setValue: [SetValue, SetNewline],
    },
});
