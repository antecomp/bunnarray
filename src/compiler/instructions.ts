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
    | { op: 'END' };

export type Program = {
    instructions: Instruction[]
    // memory?
}