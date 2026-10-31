export type BnyCondition = {
    identifier: string;
    value: string;
};

export type BnyInstruction =
    | { op: 'SAY'; text: string }
    | {
        op: 'CHOICE';
        choices: {
            text: string;
            target: number;
            condition?: BnyCondition;
            id?: string;
        }[];
        fallback: number;
    }
    | {
        op: 'BRANCH';
        cases: {
            condition: BnyCondition;
            target: number;
        }[];
        fallback: number;
    }
    | { op: 'JUMP'; target: number }
    | {
        op: 'SET';
        identifier: string;
        value: string | null;
    }
    | {
        op: 'SIGNAL';
        identifier: string;
        value?: string;
    }
    | {
        op: 'YIELD';
        identifier: string;
        value?: string;
    }
    | {
        op: 'SPEAKER';
        value: string | null;
    }
    | {
        op: 'ALTERNATE';
        speakers: (string | null)[];
    }
    | { op: 'END' };

export type BnyOpcode = BnyInstruction['op'];

export type BnyOperation<O extends BnyOpcode> = Extract<BnyInstruction, { op: O }>;

/** A compiled BunNarraY program. This is to be passed to the interpreter (createVM) */
export type BnyProgram = {
    instructions: BnyInstruction[];
    version: BnyVersion;
};

export type BnyVersion = {
    major: number;
    minor: number;
    patch?: string;
};
