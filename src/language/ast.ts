export type DialogueAST = {
    type: 'dialogue';
    statements: Statement[];
};

export type Statement =
    | SayStatement
    | ChoiceStatement
    | MatchStatement
    | SkipStatement
    | LabelStatement
    | GotoStatement;

export type SayStatement = {
    type: 'say';
    text: string;
    // direcives: Record<string, string>;
}

export type ChoiceStatement = {
    type: 'choice';
    choices: ChoiceBranch[]
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