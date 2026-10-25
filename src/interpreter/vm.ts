import type { EqualityCondition, Program } from '../compiler/instructions';
import once from '../util/once';
import createMemory from './mem';
import type { SignalNotification } from './signals';
import createSubscriptions from './subscriptions';

type Presentation = {
    text: string;
    speaker: string | null;
};

type Yield =
    | {
        kind: 'say';
        presentation: Presentation;
        resume: () => Yield;
    }
    | {
        kind: 'choice';
        presentation: Presentation | null;
        choices: string[];
        resume: (index: number) => Yield;
    }
    | {
        kind: 'yield';
        presentation: Presentation | null;
        identifier: string;
        value: string | undefined;
        resume: () => Yield;
    }
    | {
        kind: 'end';
        presentation: Presentation | null;
    };

type VMOptions = {
    memory?: Record<string, string>
};

export default function createVM(
    program: Program,
    options: VMOptions = {}
) {
    let pending: Presentation | null = null;
    let pc: number = 0;
    let speaker: string | null = null;
    let alternateSpeakers: string[] = [];
    let nextSpeakerIndex = 0;
    const memory = createMemory(options.memory);
    const signals = createSubscriptions<SignalNotification>();

    function insertVariables(line: string): string {
        return line.replace(
            /\$([A-Za-z_][A-Za-z0-9_]*)/g,
            (_, identifier: string) => memory.get(identifier) ?? '');
    }

    function matchesCondition(condition: EqualityCondition): boolean {
        return memory.get(condition.identifier) === condition.value;
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
                        presentation: pending
                    };
                case 'SAY': {
                    const previous = pending;
                    if (alternateSpeakers.length > 0) {
                        speaker = alternateSpeakers[nextSpeakerIndex];
                        nextSpeakerIndex = (nextSpeakerIndex + 1) % alternateSpeakers.length;
                    }
                    pending = { text: insertVariables(ins.text), speaker };
                    pc++;

                    if (previous !== null) {
                        return {
                            kind: 'say',
                            presentation: previous,
                            resume: once(_run)
                        };
                    }
                    continue;
                }
                case 'CHOICE': {
                    const visibleChoices = ins.choices.filter(choice =>
                        choice.condition === undefined || matchesCondition(choice.condition)
                    );

                    if (visibleChoices.length === 0) {
                        pc = ins.fallback;
                        if (pending !== null) {
                            const presentation = pending;
                            pending = null;
                            return {
                                kind: 'say',
                                presentation,
                                resume: once(_run)
                            };
                        }
                        continue;
                    }

                    return {
                        kind: 'choice',
                        presentation: pending,
                        choices: visibleChoices.map(choice => choice.text),
                        resume: once(index => {
                            if (!visibleChoices[index]) throw new Error('Invalid choice index: ' + index);
                            pc = visibleChoices[index].target;
                            // reset pending, branch should emit prompt once
                            pending = null;
                            return _run();
                        })
                    };
                }
                case 'BRANCH':
                    pc = ins.cases.find(branchCase =>
                        matchesCondition(branchCase.condition)
                    )?.target ?? ins.fallback;
                    continue;

                case 'SET':
                    if (ins.value === undefined) {
                        memory.delete(ins.identifier);
                    } else {
                        memory.set(ins.identifier, insertVariables(ins.value));
                    }
                    pc++;
                    continue;

                case 'SIGNAL':
                    signals.notify({ identifier: ins.identifier, value: ins.value });
                    pc++;
                    continue;

                case 'YIELD': {
                    const presentation = pending;
                    pending = null;
                    pc++;
                    return {
                        kind: 'yield',
                        presentation,
                        identifier: ins.identifier,
                        value: ins.value,
                        resume: once(_run)
                    };
                }

                case 'SPEAKER':
                    speaker = ins.value;
                    alternateSpeakers = [];
                    nextSpeakerIndex = 0;
                    pc++;
                    continue;

                case 'ALTERNATE':
                    alternateSpeakers = ins.speakers;
                    nextSpeakerIndex = 0;
                    pc++;
                    continue;
            }
        }
    }

    return {
        init,
        memory,
        signals: { subscribe: signals.subscribe }
    };
}
