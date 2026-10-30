/*
dialogue -> statement*

statement ->
    | say
    | choice
    | skip
    | label
    | goto
    | set
    | speaker
    | shorthandSpeaker
    | alternate
    | branch
    | signal
    | yield

say -> Text Newline?

choice ->
    CurlyBraceOpen Newline
        choiceBranch+
    CurlyBraceClose Newline?

choiceBranch ->
    ChoiceToken (when id? | id when?)? Text Newline?
        statement*

branch ->
    BranchBlockOpen Newline
    branchCase+
    BranchBlockClose

branchCase ->
    when Newline? statement*

when -> WhenStatementOpen Identifier WhenEquals Text CloseBracket

skip ->
    SkipBlockOpen Text CloseBracket Newline
        statement*
    SkipBlockClose Newline?

set -> SetKeyword Identifier (SetEquals Text)? DirectiveNewline
signal -> SignalKeyword Identifier (SignalDelim Text)? DirectiveNewline
yield -> YieldSignalKeyword Identifier (YieldSignalDelim Text)? DirectiveNewline

label -> LabelToken Text Newline?
goto -> GotoToken Text Newline?

speaker -> SpeakerKeyword Text? Newline
shorthandSpeaker -> Pipe Text? Pipe Newline?
alternate -> AlternateKeyword Text? Newline

*/

import { CstParser } from 'chevrotain';
import {
    Newline, CurlyBraceOpen, CurlyBraceClose, SkipBlockOpen,
    SkipBlockClose, ChoiceToken,
    GotoToken, LabelToken, CloseBracket, Text, SpeakerKeyword, Pipe,
    AlternateKeyword, IdBlockOpen, IdBlockClose,

    SetKeyword, Identifier, SetEquals, DirectiveNewline,
    SignalKeyword, SignalDelim, BranchBlockOpen, BranchBlockClose,
    WhenStatementOpen, WhenEquals, YieldSignalKeyword, YieldSignalDelim,

    allTokens
} from './lexer';

class DialogueParser extends CstParser {
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
            { ALT: () => this.SUBRULE(this.branch) },
            { ALT: () => this.SUBRULE(this.skip) },
            { ALT: () => this.SUBRULE(this.label) },
            { ALT: () => this.SUBRULE(this.goto) },
            { ALT: () => this.SUBRULE(this.set) },
            { ALT: () => this.SUBRULE(this.signal) },
            { ALT: () => this.SUBRULE(this.yield) },
            { ALT: () => this.SUBRULE(this.speaker) },
            { ALT: () => this.SUBRULE(this.shorthandSpeaker) },
            { ALT: () => this.SUBRULE(this.alternate) }
        ]);
    });

    say = this.RULE('say', () => {
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline));
    });

    choice = this.RULE('choice', () => {
        this.CONSUME(CurlyBraceOpen);
        this.CONSUME(Newline);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.choiceBranch));
        this.CONSUME(CurlyBraceClose);
        this.OPTION(() => this.CONSUME1(Newline));
    });

    choiceBranch = this.RULE('choiceBranch', () => {
        this.CONSUME(ChoiceToken);
        // (when id? | id when?)? Text
        this.OPTION(() => {
            this.OR([
                {
                    ALT: () => {
                        this.SUBRULE(this.when);
                        this.OPTION1(() => this.SUBRULE(this.id));
                    }
                },
                {
                    ALT: () => {
                        this.SUBRULE1(this.id);
                        this.OPTION2(() => this.SUBRULE1(this.when));
                    }
                }
            ]);
        });
        this.CONSUME(Text);
        this.OPTION3(() => this.CONSUME(Newline));
        this.MANY(() => this.SUBRULE(this.statement));
    });

    id = this.RULE('id', () => {
        this.CONSUME(IdBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(IdBlockClose);
    });

    branch = this.RULE('branch', () => {
        this.CONSUME(BranchBlockOpen);
        this.CONSUME(Newline);
        this.AT_LEAST_ONE(() => this.SUBRULE(this.branchCase));
        this.CONSUME(BranchBlockClose);
        this.OPTION2(() => this.CONSUME2(Newline));
    });

    branchCase = this.RULE('branchCase', () => {
        this.SUBRULE(this.when);
        this.OPTION(() => this.CONSUME1(Newline));
        this.MANY(() => this.SUBRULE(this.statement));
    });

    when = this.RULE('when', () => {
        this.CONSUME(WhenStatementOpen);
        this.CONSUME(Identifier);
        this.CONSUME(WhenEquals);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
    });

    skip = this.RULE('skip', () => {
        this.CONSUME(SkipBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
        this.OPTION(() => this.CONSUME1(Newline));
        this.MANY(() => this.SUBRULE(this.statement));
        this.CONSUME(SkipBlockClose);
        this.OPTION2(() => this.CONSUME2(Newline));
    });

    set = this.RULE('set', () => {
        this.CONSUME(SetKeyword);
        this.CONSUME(Identifier);
        this.OPTION(() => {
            this.CONSUME(SetEquals);
            this.CONSUME(Text);
        });
        this.CONSUME(DirectiveNewline);
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

    speaker = this.RULE('speaker', () => {
        this.CONSUME(SpeakerKeyword);
        this.OPTION(() => this.CONSUME(Text));
        this.CONSUME(Newline);
    });

    shorthandSpeaker = this.RULE('shorthandSpeaker', () => {
        this.CONSUME(Pipe);
        this.OPTION(() => this.CONSUME(Text));
        this.CONSUME1(Pipe);
        this.OPTION1(() => this.CONSUME(Newline));
    });

    alternate = this.RULE('alternate', () => {
        this.CONSUME(AlternateKeyword);
        this.OPTION(() => this.CONSUME(Text));
        this.CONSUME(Newline);
    });

    signal = this.RULE('signal', () => {
        this.CONSUME(SignalKeyword);
        this.CONSUME(Identifier);
        this.OPTION(() => {
            this.CONSUME(SignalDelim);
            this.CONSUME(Text);
        });
        this.CONSUME(DirectiveNewline);
    });

    yield = this.RULE('yield', () => {
        this.CONSUME(YieldSignalKeyword);
        this.CONSUME(Identifier);
        this.OPTION(() => {
            this.CONSUME(YieldSignalDelim);
            this.CONSUME(Text);
        });
        this.CONSUME(DirectiveNewline);
    });

}

const parser = new DialogueParser();
export default parser;