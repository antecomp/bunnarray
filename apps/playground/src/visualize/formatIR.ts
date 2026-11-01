import type { BnyProgram } from '@bunnarray/vm';

/** Format a BnyProgram as a versioned instruction listing with indented branch targets. */
export default function formatIR(program: BnyProgram): string {
    const { major, minor, patch } = program.version;
    const version = `${major}.${minor}${patch === undefined ? '' : `-${patch}`}`;

    return `version: ${version}\n` + program.instructions.map((instruction, index) => {
        const prefix = `${index}: ${instruction.op}:`;

        switch (instruction.op) {
            case 'SAY':
                return `${prefix} ${JSON.stringify(instruction.text)}\n`;
            case 'CHOICE':
                return `${prefix}\n`
                    + instruction.choices.map(choice =>
                        `    ${choice.condition === undefined ? '' :
                            `[when:${choice.condition.identifier}=${JSON.stringify(choice.condition.value)}] `}`
                        + `${choice.id === undefined ? '' : `[id:${JSON.stringify(choice.id)}] `}`
                        + `${JSON.stringify(choice.text)} -> ${choice.target}\n`
                    ).join('')
                    + `    fallback -> ${instruction.fallback}\n`;
            case 'BRANCH':
                return `${prefix}\n`
                    + instruction.cases.map(({ condition, target }) =>
                        `    ${condition.identifier} = ${JSON.stringify(condition.value)} -> ${target}\n`
                    ).join('')
                    + `    fallback -> ${instruction.fallback}\n`;
            case 'JUMP':
                return `${prefix} -> ${instruction.target}\n`;
            case 'END':
                return `${prefix}\n`;
            case 'SET':
                return `${prefix} ${instruction.identifier} = ${JSON.stringify(instruction.value)}\n`;
            case 'SIGNAL':
                return `${prefix} ${instruction.identifier}${instruction.value === undefined ? '' : ` = ${JSON.stringify(instruction.value)}`}\n`;
            case 'YIELD':
                return `${prefix} ${instruction.identifier}${instruction.value === undefined ? '' : ` = ${JSON.stringify(instruction.value)}`}\n`;
            case 'SPEAKER':
                return `${prefix} ${JSON.stringify(instruction.value)}\n`;
            case 'ALTERNATE':
                return `${prefix} ${JSON.stringify(instruction.speakers)}\n`;
            default:
                const exhuastive: never = instruction;
                throw new Error(`Unformatted syntax node: ${exhuastive}`);
        }
    }).join('');
}
