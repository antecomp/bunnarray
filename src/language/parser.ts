/*
dialogue -> statement*

statement ->
    | say
    | choice
    | match
    | skip
    | label
    | goto

say -> Text Newline?

choice ->
    CurlyBraceOpen Newline?
        choiceBranch+
    CurlyBraceClose Newline?

choiceBranch ->
    ChoiceToken Text Newline
        statement*

match ->
    MatchBlockOpen Text CloseBracket Newline
        matchBranch+
    MatchBlockClose Newline?

matchBranch ->
    Equals Text Newline
        statement*

skip ->
    SkipBlockOpen Text CloseBracket Newline
        statement*
    SkipBlockClose Newline?

label -> LabelToken Text Newline?
goto -> GotoToken Text Newline?

*/