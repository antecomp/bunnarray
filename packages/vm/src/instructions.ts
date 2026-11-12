/** A condition used by a branch or choice in a compiled program. */
export type BnyCondition = {
    /** Memory key to test. */
    identifier: string;
    /** Expected value; omit to test whether the key exists. */
    value?: string;
    /** Invert the result of the test when `true`. I.e "unless" */
    negated?: true;
};

/** An instruction in a compiled {@link BnyProgram}. */
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

/** The `op` discriminator of a {@link BnyInstruction}. */
export type BnyOpcode = BnyInstruction['op'];

/** The instruction shape for a particular {@link BnyOpcode}. */
export type BnyOperation<O extends BnyOpcode> = Extract<BnyInstruction, { op: O }>;

/** A compiled BunNarraY dialogue passed to `createVM`. */
export type BnyProgram = {
    /** Instructions to execute; the last instruction must be `END`. */
    instructions: BnyInstruction[];
    /** Compiler version recorded in the program. */
    version: BnyVersion;
};

/** Version of the compiled program; `createVM` requires a matching major version. */
export type BnyVersion = {
    /** Major version used for VM compatibility checks. */
    major: number;
    /** Minor version of the compiled program. */
    minor: number;
    /** Optional version suffix/patch, such as `indev`. */
    patch?: string;
};
