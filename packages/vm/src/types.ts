import type createMemory from './mem';
import type { MemoryUpdate } from './mem';

/** A selectable option shown to the player. */
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
    | { kind: 'signal'; identifier: string; value: string | undefined };

export type EmissionKind = Emission['kind'];
export type EmissionBody<K extends EmissionKind> = Extract<Emission, { kind: K }>;
export type EmissionHandler = (emission: Emission) => void;

export type Pause =
    | { kind: 'next'; resume: VoidFunction }
    | { kind: 'select'; options: Option[]; resume: (index: number) => void }
    | { kind: 'yield'; identifier: string; value: string | undefined; resume: VoidFunction }
    | { kind: 'end' };

export type PauseKind = Pause['kind'];
export type PauseBody<K extends PauseKind> = Extract<Pause, { kind: K }>;
export type PauseHandler = (pause: Pause) => void;

/**
 * Configuration used to create a VM instance.
 */
export type VMOptions = {
    memory?: Record<string, string>;
    onEmission: EmissionHandler;
    onPause: PauseHandler;
};

/**
 * Runtime interface for driving a compiled instruction program.
 */
export type VM = {
    memory: ReturnType<typeof createMemory>;
    start: VoidFunction;
};
