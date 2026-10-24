import type { Program } from '../compiler/instructions';

/** Format a Program as an instruction listing with indented branch targets. */
export default function formatIR(program: Program): string {
    return program.instructions.map((instruction, index) => {
        const prefix = `${index}: ${instruction.op}:`;

        switch (instruction.op) {
            case 'SAY':
                return `${prefix} ${JSON.stringify(instruction.text)}\n`;
            case 'CHOICE':
                return instruction.choices.length === 0
                    ? `${prefix} []\n`
                    : `${prefix}\n${instruction.choices.map(choice =>
                        `    ${JSON.stringify(choice.text)} -> ${choice.target}\n`
                    ).join('')}`;
            case 'MATCH':
                return `${prefix} on ${JSON.stringify(instruction.on)}\n`
                    + Object.entries(instruction.cases).map(([value, target]) =>
                        `    ${JSON.stringify(value)} -> ${target}\n`
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
                return `${prefix} ${instruction.identifier} = ${instruction.value}\n`;
            case 'SIGNAL':
                return `${prefix} ${instruction.identifier}${instruction.value === undefined ? '' : ` = ${JSON.stringify(instruction.value)}`}\n`;
            case 'SPEAKER':
                return `${prefix} ${instruction.value}\n`;
            case 'ALTERNATE':
                return `${prefix} ${JSON.stringify(instruction.speakers)}\n`;
        }
    }).join('');
}
