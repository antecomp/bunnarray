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
    CurlyBraceOpen Newline
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

import { CstParser } from "chevrotain";
import {
    Newline, CurlyBraceOpen, CurlyBraceClose, SkipBlockOpen,
    SkipBlockClose, MatchBlockOpen, MatchBlockClose, ChoiceToken,
    GotoToken, LabelToken, Equals, CloseBracket, Text,
    allTokens
} from './lexer'

export class DialogueParser extends CstParser {
    constructor() {
        super(allTokens);
        this.performSelfAnalysis();
    }

    dialogue = this.RULE('dialogue', () => {
        this.MANY(() => this.SUBRULE(this.statement));
    });

    statement = this.RULE('statement', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.say) },
            { ALT: () => this.SUBRULE(this.choice) },
            { ALT: () => this.SUBRULE(this.match) },
            { ALT: () => this.SUBRULE(this.skip) },
            { ALT: () => this.SUBRULE(this.label) },
            { ALT: () => this.SUBRULE(this.goto) },
        ])
    });

    say = this.RULE('say', () => {
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline));
    })

    choice = this.RULE('choice', () => {
        this.CONSUME(CurlyBraceOpen);
        this.CONSUME(Newline);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.choiceBranch))
        this.CONSUME(CurlyBraceClose);
        this.OPTION(() => this.CONSUME1(Newline));
    })

    choiceBranch = this.RULE('choiceBranch', () => {
        this.CONSUME(ChoiceToken);
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline));
        this.MANY( () => this.SUBRULE(this.statement))
    })

    match = this.RULE('match', () => {
        this.CONSUME(MatchBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
        this.CONSUME(Newline);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.matchBranch))
        this.CONSUME(MatchBlockClose);
        this.OPTION(() => this.CONSUME1(Newline))
    });

    matchBranch = this.RULE('matchBranch', () => {
        this.CONSUME(Equals);
        this.CONSUME(Text);
        this.CONSUME(Newline);
        this.MANY(() => this.SUBRULE(this.statement));
    });

    skip = this.RULE('skip', () => {
        this.CONSUME(SkipBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
        this.OPTION(() => this.CONSUME1(Newline))
        this.MANY(() => this.SUBRULE(this.statement));
        this.CONSUME(SkipBlockClose);
        this.OPTION2(() => this.CONSUME2(Newline)); 
    });

    label = this.RULE('label', () => {
        this.CONSUME(LabelToken);
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline)); 
    });

    goto = this.RULE('goto', () => {
        this.CONSUME(GotoToken);
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline));
    });

}
