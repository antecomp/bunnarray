import { Program } from "../compiler/instructions";
import once from "../util/once";
import createMemory from "./mem";

type Presentation = {
    text: string;
    speaker: string | null;
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

type VMOptions = {
    memory?: Record<string, string>
}

export default function createVM(
    program: Program,
    options: VMOptions = {}
) {
    let pending: Presentation | null = null;
    let pc: number = 0;
    let speaker: string | null = null;
    const memory = createMemory(options.memory);

    function insertVariables(line: string): string {
        return line.replace(
            /\$([A-Za-z_][A-Za-z0-9_]*)/g,
            (_, identifier: string) => memory.get(identifier) ?? '');
    }

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
                    pending = { text: insertVariables(ins.text), speaker };
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
                    const value = memory.get(ins.on);

                    pc = value !== undefined
                        ? (ins.cases[value] ?? ins.fallback)
                        : ins.fallback;

                    continue;

                case 'SET':
                    if (ins.value === undefined) {
                        memory.delete(ins.identifier);
                    } else {
                        memory.set(ins.identifier, insertVariables(ins.value));
                    }
                    pc++;
                    continue;

                case 'SPEAKER':
                    speaker = ins.value;
                    pc++;
                    continue;
            }
        }
    }

    return {
        init,
        memory
    }
}
