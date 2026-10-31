import once from './once';
import type { EqualityCondition, Operation, Program, Version } from './instructions';
import createMemory, { type MemoryUpdate } from './mem';

const INSTRUCTION_BUDGET = 100_000;

const VM_VERSION = {
    major: 1,
    minor: 0,
    patch: ''
} as const satisfies Version;

function formatVersion(ver: Version): string {
    return `${ver.major}.${ver.minor}`
        + (ver.patch ? '-' + ver.patch : '');
}

/**
 * A selectable option shown to the player.
 */
export type Option = { text: string; id?: string };

/**
 * A single event emitted by the virtual machine while running a program.
 *
 * The VM emits these values to let the host application render dialogue,
 * update memory, or react to signals.
 */
export type Emission =
    | { kind: 'say'; text: string; speaker: string | null }
    | ({ kind: 'memory' } & MemoryUpdate)
    | { kind: 'signal'; identifier: string; value: string | undefined }

export type EmissionKind = Emission['kind'];
export type EmissionBody<K extends EmissionKind> = Extract<Emission, { kind: K }>

/** Constructs an Emission */
function EM<E extends Emission['kind']>(
    kind: E,
    config: Omit<Extract<Emission, { kind: E }>, 'kind'>
): Extract<Emission, { kind: E }> {
    return { kind, ...config } as Extract<Emission, { kind: E }>;
}

export type EmissionHandler = (emission: Emission) => void;
export type Choice = Operation<'CHOICE'>['choices'][number];


export type Pause =
    | { kind: 'next', resume: VoidFunction }
    | { kind: 'select', options: Option[], resume: (index: number) => void }
    | { kind: 'yield', identifier: string, value: string | undefined, resume: VoidFunction }
    | { kind: 'end' }

export type PauseKind = Pause['kind'];
export type PauseBody<K extends PauseKind> = Extract<Pause, { kind: K }>

export type PauseHandler = (pause: Pause) => void;

/**
 * Configuration used to create a VM instance.
 */
export type VMOptions = {
    memory?: Record<string, string>
    onEmission: EmissionHandler
    onPause: PauseHandler
};

/**
 * Runtime interface for driving a compiled instruction program.
 */
export type VM = {
    memory: ReturnType<typeof createMemory>;
    start: VoidFunction;
};

/**
 * Creates a bunnarray virtual machine.
 * 
 * See project README for usage instructions.
 *
 * @param program The program (compiled by @bunnarray/compiler) to execute.
 * @param options Runtime configuration including the emission handler and initial memory.
 */
export function createVM(
    program: Program,
    {
        onEmission: emit,
        onPause: pause,
        memory: initialMemory
    }: VMOptions
): VM {
    if (program.version.major !== VM_VERSION.major)
        throw new Error(
            `Program version ${formatVersion(program.version)} `
            + `incompatible with vm version ${formatVersion(VM_VERSION)}`
        );

    if (program.instructions[program.instructions.length - 1]?.op !== 'END')
        throw new Error('Program must end with an END instruction');

    const memory = createMemory(update => emit(EM('memory', update)), initialMemory);

    let pc = 0;
    let canExecSay = true;              // allow printing the say and continue (next or automatically)

    let speaker: string | null = null;
    let alternateSpeakers: (string | null)[] = [];
    let nextAlternate = 0;


    // --- util ---
    function interpolate(text: string): string {
        return text.replace(
            /\$([A-Za-z_][A-Za-z0-9_]*)/g,
            (_, identifier: string) => memory.get(identifier) ?? ''
        );
    }

    function matches(condition: EqualityCondition): boolean {
        return memory.get(condition.identifier) === condition.value;
    }

    function speakerForNextLine(): string | null {
        if (alternateSpeakers.length > 0) {
            speaker = alternateSpeakers[nextAlternate];
            nextAlternate = (nextAlternate + 1) % alternateSpeakers.length;
        }
        return speaker === null ? null : interpolate(speaker);
    }

    function run(): void {
        let instructionsRemaining = INSTRUCTION_BUDGET;

        for (; ;) {
            if (instructionsRemaining-- <= 0)
                throw new Error(`Instruction budget (${INSTRUCTION_BUDGET}) exceeded at pc ${pc}. Do you have an infinite loop?`);

            if (!Number.isInteger(pc) || pc < 0 || pc >= program.instructions.length)
                throw new Error(`pc (${pc}) out of program range!`);

            const ins = program.instructions[pc];

            switch (ins.op) {
                case 'JUMP':
                    pc = ins.target;
                    continue;

                case 'BRANCH':
                    pc = ins.cases.find(branchCase => matches(branchCase.condition))?.target ?? ins.fallback;
                    continue;

                case 'SET':
                    if (ins.value === null) memory.delete(ins.identifier);
                    else memory.set(ins.identifier, interpolate(ins.value));
                    pc++;
                    continue;

                case 'SPEAKER':
                    speaker = ins.value;
                    alternateSpeakers = [];
                    nextAlternate = 0;
                    pc++;
                    continue;

                case 'ALTERNATE':
                    alternateSpeakers = ins.speakers;
                    nextAlternate = 0;
                    pc++;
                    continue;

                case 'SIGNAL':
                    emit(EM('signal', { identifier: ins.identifier, value: ins.value }));
                    pc++;
                    continue;

                case 'YIELD':
                    pc++;
                    return pause({
                        kind: 'yield',
                        identifier: ins.identifier,
                        value: ins.value,
                        resume: once(run)
                    })

                case 'SAY':
                    // Pause *before* execution.
                    if (!canExecSay) return pause({
                        kind: 'next',
                        resume: once(() => {
                            canExecSay = true;
                            run();
                        })
                    })
                    canExecSay = false;
                    emit(EM('say', {
                        text: interpolate(ins.text),
                        speaker: speakerForNextLine()
                    }));
                    pc++;
                    continue;

                case 'CHOICE': {
                    const choices = ins.choices.filter(
                        choice => choice.condition === undefined || matches(choice.condition)
                    );
                    if (choices.length === 0) {
                        pc = ins.fallback;
                        continue;
                    }
                    const select = once((choice: Choice) => {
                        pc = choice.target;
                        canExecSay = true;
                        run()
                    });

                    return pause({
                        kind: 'select',
                        options: choices.map(({text, id}) => ({text, id})),
                        resume(index) {
                            const choice = Number.isInteger(index)
                                ? choices[index]
                                : undefined;
                            if (!choice)
                                throw new Error (`Invalid choice index: ${index}`);

                            select(choice);
                        }
                    })
                }

                case 'END':
                    return pause({kind: 'end'});

                default:
                    const exhaustive: never = ins;
                    throw new Error(`Unhandled instruction: ${exhaustive}`);
            }
        }
    }

    return {
        memory,

        start: once(() => {
            canExecSay = true;
            run();
        }, 'VM already started!')
    };
}
