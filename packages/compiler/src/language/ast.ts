export type DialogueAST = {
    type: 'dialogue';
    statements: Statement[];
};

export type Statement =
    | SayStatement
    | ChoiceStatement
    | BranchStatement
    | SkipStatement
    | SetStatement
    | SignalStatement
    | YieldStatement
    | LabelStatement
    | GotoStatement
    | SpeakerStatement
    | AlternateStatement;

export type SayStatement = {
    type: 'say';
    text: string;
    // direcives: Record<string, string>;
};

export type ChoiceStatement = {
    type: 'choice';
    branches: ChoiceBranch[]
};

export type ChoiceBranch = {
    type: 'choiceBranch'
    text: string,
    condition: Condition | undefined
    id: string | undefined
    statements: Statement[]
};

export type Condition = {
    type: 'equals'
    identifier: string;
    value: string;
};

export type BranchStatement = {
    type: 'branch';
    cases: BranchCase[] // first true case wins
};

export type BranchCase = {
    type: 'branchCase';
    condition: Condition;
    statements: Statement[];
};

export type SetStatement = {
    type: 'set';
    identifier: string,
    value: string | null
};

export type SignalStatement = {
    type: 'signal';
    identifier: string,
    value?: string
};

export type YieldStatement = {
    type: 'yield';
    identifier: string,
    value?: string;
};

export type SkipStatement = {
    type: 'skip';
    label: string;
    statements: Statement[];
};

export type LabelStatement = {
    type: 'label';
    name: string;
};

export type GotoStatement = {
    type: 'goto';
    target: string;
};

export type SpeakerStatement = {
    type: 'speaker';
    value: string | null;
};

export type AlternateStatement = {
    type: 'alternate';
    speakers: (string | null)[];
};
