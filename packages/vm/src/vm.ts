import type { EqualityCondition, Operation, Program, Version } from './instructions';
import createMemory, { type MemoryUpdate } from './mem';

const VM_VERSION = {
    major: 1,
    minor: 0,
    patch: ''
} as const satisfies Version;

function formatVersion(ver: Version): string {
    return `${ver.major}.${ver.minor}-${ver.patch}`;
}

export type Option = { text: string; id?: string };

export type Emission =
    | { kind: 'say'; text: string; speaker: string | null }
    | ({ kind: 'memory' } & MemoryUpdate)
    | { kind: 'signal'; identifier: string; value: string | undefined }
    | { kind: 'yield'; identifier: string; value: string | undefined }
    | { kind: 'options'; options: Option[] }
    | { kind: 'end' };

/** Constructs an Emission */
export function EM<E extends Emission['kind']>(
    kind: E,
    config: Omit<Extract<Emission, { kind: E }>, 'kind'>
): Extract<Emission, { kind: E }> {
    return { kind, ...config } as Extract<Emission, { kind: E }>;
}

export type Wait = 'next' | 'select' | 'yield' | 'end';

type EmissionHandler = (emission: Emission) => void;
type Choice = Operation<'CHOICE'>['choices'][number];

export type VMOptions = {
    memory?: Record<string, string>
    handler: EmissionHandler
};

export type VM = {
    memory: ReturnType<typeof createMemory>;
    start(): Wait;
    next(): Wait;
    choose(index: number): Wait;
    resume(): Wait;
};

export function createVM(program: Program, { handler: emit, memory: initialMemory }: VMOptions): VM {
    if (program.version.major !== VM_VERSION.major)
        throw new Error(
            `Program version ${formatVersion(program.version)} `
            + `incompatible with vm version ${formatVersion(VM_VERSION)}`
        );

    if (program.instructions[program.instructions.length - 1]?.op !== 'END')
        throw new Error('Program must end with an END instruction');

    const memory = createMemory(update => emit(EM('memory', update)), initialMemory);

    let pc = 0;
    let started = false;
    let waiting: Wait | null = null;    // what the consumer owes before resuming.
    let canExecSay = true;              // allow printing the say and continue (next or automatically)
    let visibleChoices: Choice[] = [];  // snapshot of visible choices

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

    function stopWith(wait: Wait): Wait {
        waiting = wait;
        return wait;
    }

    function run(): Wait {
        waiting = null;

        for (; ;) {
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
                    emit(EM('yield', { identifier: ins.identifier, value: ins.value }));
                    pc++;
                    return stopWith('yield');

                case 'SAY':
                    // Pause *before* execution.
                    if (!canExecSay) return stopWith('next');
                    canExecSay = false;
                    emit(EM('say', {
                        text: interpolate(ins.text),
                        speaker: speakerForNextLine()
                    }));
                    pc++;
                    continue;

                case 'CHOICE':
                    visibleChoices = ins.choices.filter(
                        choice => choice.condition === undefined || matches(choice.condition)
                    );
                    if (visibleChoices.length === 0) {
                        pc = ins.fallback;
                        continue;
                    }
                    emit(EM('options', {
                        options: visibleChoices.map(choice => ({
                            text: choice.text,
                            id: choice.id
                        }))
                    }));
                    return stopWith('select');

                case 'END':
                    emit({ kind: 'end' });
                    return stopWith('end');

                default:
                    const exhaustive: never = ins;
                    throw new Error(`Unhandled instruction: ${exhaustive}`);
            }
        }
    }

    // --- API ---
    function expectWaiting(wait: Wait, caller: string): void {
        if (waiting !== wait) {
            throw new Error(
                `${caller}() called, but the VM is `
                + (waiting === null ? 'not paused' : `waiting for '${waiting}'`)
            );
        }
    }

    return {
        memory,

        start(): Wait {
            if (started) throw new Error('VM already started');
            started = true;
            canExecSay = true;
            return run();
        },

        next(): Wait {
            expectWaiting('next', 'next');
            canExecSay = true;
            return run();
        },

        choose(index: number): Wait {
            expectWaiting('select', 'choose');
            const choice = visibleChoices[index];
            if (!choice) throw new Error('Invalid choice index: ' + index);
            pc = choice.target;
            canExecSay = true;
            return run();
        },

        // doesn't affect canExecSay -- inherits how we should block from above
        resume(): Wait {
            expectWaiting('yield', 'resume');
            return run();
        }

    };
}
