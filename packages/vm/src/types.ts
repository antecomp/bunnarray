import type { BnyMemory, BnyMemorySnapshot, BnyMemoryUpdate } from './mem';

/** A visible choice presented in a {@link BnyPause} with `kind: 'select'`. */
export type BnyOption = {
    /** Text to display for the choice. */
    text: string;
    /** Optional tag for host display logic; it does not affect the choice. */
    id?: string;
};

/**
 * An event emitted while the VM runs a dialogue.
 *
 * Emissions do not pause execution. Use {@link BnyEmissionHandler} to render
 * dialogue, observe memory changes, or handle signals.
 * 
 * See the {@link https://github.com/antecomp/bunnarray/blob/main/packages/vm/README.md|VM README}
 * for details on emissions and pauses.
 */
export type BnyEmission =
    | { kind: 'say'; text: string; speaker: string | null }
    | ({ kind: 'memory' } & BnyMemoryUpdate)
    | { kind: 'signal'; identifier: string; value: string | undefined };

/** The discriminator for a {@link BnyEmission}. */
export type BnyEmissionKind = BnyEmission['kind'];
/** The emission shape associated with a particular {@link BnyEmissionKind}. */
export type BnyEmissionBody<K extends BnyEmissionKind> = Extract<BnyEmission, { kind: K }>;
/** Called whenever the VM emits dialogue, a memory update, or a signal. */
export type BnyEmissionHandler = (emission: BnyEmission) => void;

/**
 * A point where the VM stops and reports what the host must do next.
 *
 * `next`, `select`, and `yield` include a one-use `resume` callback. `end` and
 * `error` are terminal. 
 * 
 * See the {@link https://github.com/antecomp/bunnarray/blob/main/packages/vm/README.md|VM README}
 * for details on emissions and pauses.
 */
export type BnyPause =
    | { kind: 'next'; resume: VoidFunction }
    | { kind: 'select'; options: BnyOption[]; resume: (index: number) => void }
    | { kind: 'yield'; identifier: string; value: string | undefined; resume: VoidFunction }
    | { kind: 'end' }
    | { kind: 'error'; error: Error };

/** The discriminator for a {@link BnyPause}. */
export type BnyPauseKind = BnyPause['kind'];
/** The pause shape associated with a particular {@link BnyPauseKind}. */
export type BnyPauseBody<K extends BnyPauseKind> = Extract<BnyPause, { kind: K }>;
/** Called whenever the VM stops for input, completes, or encounters an error. */
export type BnyPauseHandler = (pause: BnyPause) => void;

/**
 * Runtime configuration passed to `createVM`.
 */
export type BnyVMOptions = {
    /** Initial memory available to the dialogue before {@link BnyVM.start}. */
    memory?: BnyMemorySnapshot;
    /** Receives non-blocking VM events. */
    onEmission: BnyEmissionHandler;
    /** Receives pauses and supplies input to continue through their `resume` callbacks. */
    onPause: BnyPauseHandler;
};

/**
 * A VM instance interface for one run of a compiled BunNarraY dialogue.
 *
 * See the
 * {@link https://github.com/antecomp/bunnarray/blob/main/packages/vm/README.md|VM README}
 * for usage.
 */
export type BnyVM = {
    /** Read or update string-valued memory, including while the VM is paused. */
    memory: BnyMemory;
    /** Start execution. Call once per instance; subsequent calls throw. */
    start: VoidFunction;
};
