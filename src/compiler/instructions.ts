export type Instruction =
    | { op: 'SAY', text: string }
    | {
        op: 'CHOICE',
        choices: {
            text: string;
            target: number
        }[]
    }
    | {
        op: 'MATCH'
        on: string
        cases: Record<string, number>
        fallback: number // no match
    }
    | { op: 'JUMP'; target: number }
    | { op: 'SET'; 
        identifier: string, 
        value: string | undefined 
    }
    | { op: 'SPEAKER';
        value: string | null;
    }
    | { op: 'ALTERNATE';
        speakers: string[];
    }
    | { op: 'END' };

export type Opcode = Instruction['op'];

export type Operation<O extends Opcode> = Extract<Instruction, { op: O }>;

/** Construct an Instruction */
export function INS<O extends Opcode>(
    opcode: O,
    config: Omit<Extract<Instruction, { op: O }>, 'op'>
): Extract<Instruction, { op: O }> {
    return { op: opcode, ...config } as Operation<O>;
}

export type Program = {
    instructions: Instruction[]
    // debug symbols?
};