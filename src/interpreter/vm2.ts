import type { EqualityCondition, Operation, Program } from '../compiler/instructions';
import once from '../util/once';
import createMemory from './mem';

export type Emission =
    | { kind: 'say'; text: string; speaker: string | null }
    | { kind: 'signal'; identifier: string; value: string | undefined }
    | { kind: 'yield'; identifier: string; value: string | undefined }
    | { kind: 'options'; options: string[] }
    | { kind: 'end' }

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

type VMOptions = {
    memory?: Record<string, string>
    handler: EmissionHandler
}

export default function createVM(program: Program, { handler: emit, memory: initialMemory }: VMOptions) {
    const memory = createMemory(initialMemory);

    let pc = 0;
    let waiting: Wait | null = null;    // what the consumer owes before resuming.
    let autoAdvance = true;             // print a say without next call (i.e at start / after options
    // TODO: Can we bundle this into the emission cleaner? So we're not working by index?
    let visibleChoices: Choice[] = [];

    let speaker: string | null = null;
    let alternateSpeakers: string[] = [];
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
        return speaker;
    }

    function stopWith(wait: Wait): Wait {
        waiting = wait;
        return wait;
    }

    function run(): Wait {
        waiting = null;

        for (; ;) {
            const ins = program.instructions[pc];

            switch(ins.op) {
                case 'JUMP':
                    pc = ins.target;
                    continue;

                case 'BRANCH':
                    pc = ins.cases.find(branchCase => matches(branchCase.condition))?.target ?? ins.fallback;
                    continue;

                case 'SET':
                    if (ins.value === undefined) memory.delete(ins.identifier);
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
                    emit(EM('signal', ins));
                    pc++;
                    break;
            }
        }
    }



    // --- API ---
    function expectWaiting(wait: Wait, caller: string): void {
        if (waiting !== wait) {
            throw new Error(`${caller}() called, but the VM is ${waiting === null ? 'not paused' : `waiting for '${waiting}'`
                }.`);
        }
    }

    return {
        memory,

        start: once(() => {

        })
    }
}