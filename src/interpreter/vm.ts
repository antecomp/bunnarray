import { Program } from "../compiler/instructions";
import once from "../util/once";

type Presentation = {
    text: string;
    // speaker, eventually
};

type Yield =
    | {
        kind: "say";
        presentation: Presentation;
        resume: () => Yield;
    }
    | {
        kind: "choice";
        presentation: Presentation | null;
        choices: string[];
        resume: (index: number) => Yield;
    }
    | {
        kind: "end";
        presentation: Presentation | null;
    };

export default function createVM(program: Program) {
    let pending: Presentation | null = null;
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
                        presentation: pending,
                    };
                case 'SAY': {
                    const previous = pending;
                    pending = { text: ins.text };
                    pc++;

                    if (previous !== null) {
                        return {
                            kind: 'say',
                            presentation: previous,
                            resume: once(_run),
                        };
                    }
                    continue;
                }
                case 'CHOICE':
                    return {
                        kind: 'choice',
                        presentation: pending,
                        choices: ins.choices.map(choice => choice.text),
                        resume: once((index) => {
                            if (!ins.choices[index]) throw new Error('Invalid choice index: ' + index);
                            pc = ins.choices[index].target
                            // reset pending, branch should emit prompt once
                            pending = null;
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
