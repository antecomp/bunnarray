import { Program } from "../compiler/instructions";
import once from "../util/once";

type Yield =
    | {
        kind: "say";
        text: string;
        resume: () => Yield;
    }
    | {
        kind: "choice";
        text: string | null;
        choices: string[];
        resume: (index: number) => Yield;
    }
    | {
        kind: "end";
        text: string | null;
    };

type PresentationState = {
    text: string | null
    // speaker, eventually, consider hoisting the "| null" up when that happens.
}

export default function createVM(program: Program) {
    const pending: PresentationState = { text: null };
    let pc: number = 0;

    const init = once(_run);

    function _run(): Yield {
        for (; ;) {
            const ins = program.instructions[pc];

            switch (ins.op) {
                case 'JUMP':
                    pc = ins.target;
                    continue;
                case 'END':
                    return {
                        kind: 'end',
                        text: pending.text,
                    };
                case 'SAY': {
                    const previous = pending.text;
                    pending.text = ins.text;
                    pc++;

                    if (previous !== null) {
                        return {
                            kind: 'say',
                            text: previous,
                            resume: once(_run),
                        };
                    }
                    continue;
                }
                case 'CHOICE':
                    return {
                        kind: 'choice',
                        text: pending.text,
                        choices: ins.choices.map(choice => choice.text),
                        resume: once((index) => {
                            if (!ins.choices[index]) throw new Error('Invalid choice index: ' + index);
                            pc = ins.choices[index].target
                            // reset pending, branch should emit prompt once
                            pending.text = null;
                            return _run();
                        })
                    }
                case 'MATCH':
                    // TODO: Need VM memory for this to work
                    throw new Error('Match currently unsupported');
            }
        }
    }

    return {
        init
    }
}
