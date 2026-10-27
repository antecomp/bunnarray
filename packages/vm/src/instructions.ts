export type EqualityCondition = {
    identifier: string;
    value: string;
};

export type Instruction =
    | { op: 'SAY', text: string }
    | {
        op: 'CHOICE',
        choices: {
            text: string;
            target: number;
            condition?: EqualityCondition;
            id?: string;
        }[]
        fallback: number;
    }
    | {
        op: 'BRANCH',
        cases: {
            condition: EqualityCondition;
            target: number
        }[]
        fallback: number
    }
    | { op: 'JUMP'; target: number }
    | {
        op: 'SET';
        identifier: string,
        value: string | undefined
    }
    | {
        op: 'SIGNAL';
        identifier: string,
        value: string | undefined
    }
    | {
        op: 'YIELD';
        identifier: string,
        value: string | undefined
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

export type Opcode = Instruction['op'];

export type Operation<O extends Opcode> = Extract<Instruction, { op: O }>;

export type Program = {
    instructions: Instruction[]
    version: Version
};

export type Version = {
    major: number;
    minor: number;
    patch?: string;
};
