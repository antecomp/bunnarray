export class OnceConsumedError extends Error {
    constructor(message = 'Callback already consumed') {
        super(message);
        this.name = 'OnceConsumedError';
    }
}

/**
 * Wraps a callback so it can only be called once.
 *
 * The wrapper throws if it is invoked a second time, preventing accidental reuse
 * of a completion or resume callback.
 *
 * @template T The argument tuple accepted by the wrapped function.
 * @template R The return type of the wrapped function.
 * @param fn The callback to wrap.
 * @param message The error message used when the callback is reused.
 * @returns A callback that invokes `fn` at most once.
 */
export default function once<T extends unknown[], R>(
    fn: (...args: T) => R,
    message?: string
): (...args: T) => R {
    let used = false;

    return (...args) => {
        if (used) {
            throw new OnceConsumedError(message);
        }

        used = true;
        return fn(...args);
    };
}
