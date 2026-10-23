export type DialogueAST = {
    type: 'dialogue';
    statements: Statement[];
};

export type Statement =
    | SayStatement
    | ChoiceStatement
    | MatchStatement
    | SkipStatement
    | SetStatement
    | LabelStatement
    | GotoStatement
    | SpeakerStatement;

export type SayStatement = {
    type: 'say';
    text: string;
    // direcives: Record<string, string>;
}

export type ChoiceStatement = {
    type: 'choice';
    branches: ChoiceBranch[]
}

export type ChoiceBranch = {
    type: 'choiceBranch'
    text: string,
    statements: Statement[]
}

export type MatchStatement = {
    type: 'match',
    on: string,
    branches: MatchBranch[]
}

export type MatchBranch = {
    type: 'matchBranch'
    case: string;
    statements: Statement[];
}

export type SetStatement = {
    type: 'set';
    identifier: string,
    value: string | undefined
}

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
}