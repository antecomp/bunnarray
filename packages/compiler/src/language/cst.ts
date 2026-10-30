import type { CstNode, ICstVisitor, IToken } from 'chevrotain';

export interface DialogueCstNode extends CstNode {
    name: 'dialogue';
    children: DialogueCstChildren;
}

export type DialogueCstChildren = {
    statement?: StatementCstNode[];
};

export interface StatementCstNode extends CstNode {
    name: 'statement';
    children: StatementCstChildren;
}

export type StatementCstChildren = {
    say?: SayCstNode[];
    choice?: ChoiceCstNode[];
    branch?: BranchCstNode[];
    skip?: SkipCstNode[];
    label?: LabelCstNode[];
    goto?: GotoCstNode[];
    set?: SetCstNode[];
    signal?: SignalCstNode[];
    yield?: YieldCstNode[];
    speaker?: SpeakerCstNode[];
    shorthandSpeaker?: ShorthandSpeakerCstNode[];
    alternate?: AlternateCstNode[];
};

export interface SayCstNode extends CstNode {
    name: 'say';
    children: SayCstChildren;
}

export type SayCstChildren = {
    Text: IToken[];
    Newline?: IToken[];
};

export interface ChoiceCstNode extends CstNode {
    name: 'choice';
    children: ChoiceCstChildren;
}

export type ChoiceCstChildren = {
    CurlyBraceOpen: IToken[];
    Newline: (IToken)[];
    choiceBranch: ChoiceBranchCstNode[];
    CurlyBraceClose: IToken[];
};

export interface ChoiceBranchCstNode extends CstNode {
    name: 'choiceBranch';
    children: ChoiceBranchCstChildren;
}

export type ChoiceBranchCstChildren = {
    ChoiceToken: IToken[];
    when?: (WhenCstNode)[];
    id?: (IdCstNode)[];
    Text: IToken[];
    Newline?: IToken[];
    statement?: StatementCstNode[];
};

export interface IdCstNode extends CstNode {
    name: 'id';
    children: IdCstChildren;
}

export type IdCstChildren = {
    IdBlockOpen: IToken[];
    Text: IToken[];
    IdBlockClose: IToken[];
};

export interface BranchCstNode extends CstNode {
    name: 'branch';
    children: BranchCstChildren;
}

export type BranchCstChildren = {
    BranchBlockOpen: IToken[];
    Newline: (IToken)[];
    branchCase: BranchCaseCstNode[];
    BranchBlockClose: IToken[];
};

export interface BranchCaseCstNode extends CstNode {
    name: 'branchCase';
    children: BranchCaseCstChildren;
}

export type BranchCaseCstChildren = {
    when: WhenCstNode[];
    Newline?: IToken[];
    statement?: StatementCstNode[];
};

export interface WhenCstNode extends CstNode {
    name: 'when';
    children: WhenCstChildren;
}

export type WhenCstChildren = {
    WhenStatementOpen: IToken[];
    Identifier: IToken[];
    WhenEquals: IToken[];
    Text: IToken[];
    CloseBracket: IToken[];
};

export interface SkipCstNode extends CstNode {
    name: 'skip';
    children: SkipCstChildren;
}

export type SkipCstChildren = {
    SkipBlockOpen: IToken[];
    Text: IToken[];
    CloseBracket: IToken[];
    Newline?: (IToken)[];
    statement?: StatementCstNode[];
    SkipBlockClose: IToken[];
};

export interface SetCstNode extends CstNode {
    name: 'set';
    children: SetCstChildren;
}

export type SetCstChildren = {
    SetKeyword: IToken[];
    Identifier: IToken[];
    SetEquals?: IToken[];
    Text?: IToken[];
    DirectiveNewline: IToken[];
};

export interface LabelCstNode extends CstNode {
    name: 'label';
    children: LabelCstChildren;
}

export type LabelCstChildren = {
    LabelToken: IToken[];
    Text: IToken[];
    Newline?: IToken[];
};

export interface GotoCstNode extends CstNode {
    name: 'goto';
    children: GotoCstChildren;
}

export type GotoCstChildren = {
    GotoToken: IToken[];
    Text: IToken[];
    Newline?: IToken[];
};

export interface SpeakerCstNode extends CstNode {
    name: 'speaker';
    children: SpeakerCstChildren;
}

export type SpeakerCstChildren = {
    SpeakerKeyword: IToken[];
    Text?: IToken[];
    Newline: IToken[];
};

export interface ShorthandSpeakerCstNode extends CstNode {
    name: 'shorthandSpeaker';
    children: ShorthandSpeakerCstChildren;
}

export type ShorthandSpeakerCstChildren = {
    Pipe: (IToken)[];
    Text?: IToken[];
    Newline?: IToken[];
};

export interface AlternateCstNode extends CstNode {
    name: 'alternate';
    children: AlternateCstChildren;
}

export type AlternateCstChildren = {
    AlternateKeyword: IToken[];
    Text?: IToken[];
    Newline: IToken[];
};

export interface SignalCstNode extends CstNode {
    name: 'signal';
    children: SignalCstChildren;
}

export type SignalCstChildren = {
    SignalKeyword: IToken[];
    Identifier: IToken[];
    SignalDelim?: IToken[];
    Text?: IToken[];
    DirectiveNewline: IToken[];
};

export interface YieldCstNode extends CstNode {
    name: 'yield';
    children: YieldCstChildren;
}

export type YieldCstChildren = {
    YieldSignalKeyword: IToken[];
    Identifier: IToken[];
    YieldSignalDelim?: IToken[];
    Text?: IToken[];
    DirectiveNewline: IToken[];
};

export interface ICstNodeVisitor<IN, OUT> extends ICstVisitor<IN, OUT> {
    dialogue(children: DialogueCstChildren, param?: IN): OUT;
    statement(children: StatementCstChildren, param?: IN): OUT;
    say(children: SayCstChildren, param?: IN): OUT;
    choice(children: ChoiceCstChildren, param?: IN): OUT;
    choiceBranch(children: ChoiceBranchCstChildren, param?: IN): OUT;
    id(children: IdCstChildren, param?: IN): OUT;
    branch(children: BranchCstChildren, param?: IN): OUT;
    branchCase(children: BranchCaseCstChildren, param?: IN): OUT;
    when(children: WhenCstChildren, param?: IN): OUT;
    skip(children: SkipCstChildren, param?: IN): OUT;
    set(children: SetCstChildren, param?: IN): OUT;
    label(children: LabelCstChildren, param?: IN): OUT;
    goto(children: GotoCstChildren, param?: IN): OUT;
    speaker(children: SpeakerCstChildren, param?: IN): OUT;
    shorthandSpeaker(children: ShorthandSpeakerCstChildren, param?: IN): OUT;
    alternate(children: AlternateCstChildren, param?: IN): OUT;
    signal(children: SignalCstChildren, param?: IN): OUT;
    yield(children: YieldCstChildren, param?: IN): OUT;
}
