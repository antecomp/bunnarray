import type createMemory from './mem';
import type { BnyMemoryUpdate } from './mem';

/** A selectable option shown to the player. */
export type BnyOption = { text: string; id?: string };

/**
 * A single event emitted by the virtual machine while running a program.
 *
 * The VM emits these values to let the host application render dialogue,
 * update memory, or react to signals.
 */
export type BnyEmission =
    | { kind: 'say'; text: string; speaker: string | null }
    | ({ kind: 'memory' } & BnyMemoryUpdate)
    | { kind: 'signal'; identifier: string; value: string | undefined };

export type BnyEmissionKind = BnyEmission['kind'];
export type BnyEmissionBody<K extends BnyEmissionKind> = Extract<BnyEmission, { kind: K }>;
export type BnyEmissionHandler = (emission: BnyEmission) => void;

export type BnyPause =
    | { kind: 'next'; resume: VoidFunction }
    | { kind: 'select'; options: BnyOption[]; resume: (index: number) => void }
    | { kind: 'yield'; identifier: string; value: string | undefined; resume: VoidFunction }
    | { kind: 'end' };

export type BnyPauseKind = BnyPause['kind'];
export type BnyPauseBody<K extends BnyPauseKind> = Extract<BnyPause, { kind: K }>;
export type BnyPauseHandler = (pause: BnyPause) => void;

/**
 * Configuration used to create a VM instance.
 */
export type BnyVMOptions = {
    memory?: Record<string, string>;
    onEmission: BnyEmissionHandler;
    onPause: BnyPauseHandler;
};

/**
 * Runtime interface for driving a compiled instruction program.
 */
export type BnyVM = {
    memory: ReturnType<typeof createMemory>;
    start: VoidFunction;
};
