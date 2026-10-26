import { createToken, Lexer } from 'chevrotain';

export const Newline = createToken({
    name: 'Newline',
    pattern: /\n/
});

// --- Question Blocks ---

export const CurlyBraceOpen = createToken({
    name: 'CurlyBraceOpen',
    pattern: /\{/
});

export const CurlyBraceClose = createToken({
    name: 'CurlyBraceClose',
    pattern: /\}/
});

export const ChoiceToken = createToken({
    name: 'ChoiceToken',
    pattern: /\?:[ \t]*/
});

// --- Other Blocks ---

export const CloseBracket = createToken({
    name: 'CloseBracket',
    pattern: /\]/
});

export const SkipBlockOpen = createToken({
    name: 'SkipBlockOpen',
    pattern: /\[skip:/
});

export const SkipBlockClose = createToken({
    name: 'SkipBlockClose',
    pattern: /\[\/skip\]/
});

// --- Labels & Gotos ---

export const GotoToken = createToken({
    name: 'GotoToken',
    pattern: /->[ \t]*/
});

export const LabelToken = createToken({
    name: 'LabelToken',
    pattern: /@[ \t]*/
});

// -- Remaining text ---
// Ignore whitespace between syntax tokens (for example, the gap in `} {`).
// Spaces inside a Text token are consumed by Text and remain part of its image.
export const Whitespace = createToken({
    name: 'Whitespace',
    pattern: /[ \t]+/,
    group: Lexer.SKIPPED
});

// Consumes all characters up excluding \n, [] and {}
export const Text = createToken({
    name: 'Text',
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

export const DirectiveNewline = createToken({
    name: 'DirectiveNewline',
    pattern: /\n/,
    pop_mode: true
});


// --- Speaker Logic ---
export const SpeakerKeyword = createToken({
    name: 'SpeakerKeyword',
    pattern: /:SPEAKER\b/
});

export const AlternateKeyword = createToken({
    name: 'AlternateKeyword',
    pattern: /:ALTERNATE\b/
});


// --- Signals ---
export const SignalKeyword = createToken({
    name: 'SignalKeyword',
    pattern: /:SIGNAL\b/,
    push_mode: 'signalHeader'
});

export const SignalDelim = createToken({
    name: 'SignalDelim',
    pattern: /:[ \t]*/,
    pop_mode: true,
    push_mode: 'signalValue'
});

export const YieldSignalKeyword = createToken({
    name: 'YieldSignalKeyword',
    pattern: /:YIELD\b/,
    push_mode: 'yieldHeader'
});

export const YieldSignalDelim = createToken({
    name: 'YieldSignalDelim',
    pattern: /:[ \t]*/,
    pop_mode: true,
    push_mode: 'yieldValue'
});

// --- Branches and Conditionals ---
export const BranchBlockOpen = createToken({
    name: 'BranchBlockOpen',
    pattern: /\[branch]/
});

export const BranchBlockClose = createToken({
    name: 'BranchBlockClose',
    pattern: /\[\/branch\]/
});

export const WhenStatementOpen = createToken({
    name: 'WhenStatementOpen',
    pattern: /\[when:/,
    push_mode: 'whenHeader'
});

export const WhenEquals = createToken({
    name: 'WhenEquals',
    pattern: /=[ \t]*/,
    pop_mode: true
});

// --- Option IDs ---
export const IdBlockOpen = createToken({
    name: 'IdBlockOpen',
    pattern: /\[id:/,
    push_mode: 'idHeader'
});

export const IdBlockClose = createToken({
    name: 'IdBlockClose',
    pattern: /\]/,
    pop_mode: true
});

// --- Lexer ---
// Order is priority, first match wins.

const normalTokens = [
    Newline,
    CurlyBraceOpen,
    CurlyBraceClose,
    SkipBlockOpen,
    SkipBlockClose,
    BranchBlockOpen,
    BranchBlockClose,
    WhenStatementOpen,
    ChoiceToken,
    GotoToken,
    LabelToken,
    SetKeyword,
    SpeakerKeyword,
    AlternateKeyword,
    SignalKeyword,
    YieldSignalKeyword,
    IdBlockOpen,
    CloseBracket,
    Whitespace,
    Text
];

export const allTokens = [
    ...normalTokens,
    Identifier,
    SetEquals,
    WhenEquals,
    SignalDelim,
    YieldSignalDelim,
    IdBlockClose,
    DirectiveNewline
];

export const DialogueLexer = new Lexer({
    defaultMode: 'normal',
    modes: {
        normal: normalTokens,
        setHeader: [Whitespace, Identifier, SetEquals, DirectiveNewline],
        setValue: [Text, DirectiveNewline],
        signalHeader: [Whitespace, Identifier, SignalDelim, DirectiveNewline],
        signalValue: [Text, DirectiveNewline],
        yieldHeader: [Whitespace, Identifier, YieldSignalDelim, DirectiveNewline],
        yieldValue: [Text, DirectiveNewline],
        whenHeader: [Whitespace, Identifier, WhenEquals, DirectiveNewline],
        idHeader: [Text, IdBlockClose]
    }
});
