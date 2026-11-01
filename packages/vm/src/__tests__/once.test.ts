import { describe, expect, it, vi } from 'vitest';
import once, { OnceConsumedError } from '../once';

describe('once', () => {
    it('forwards arguments and the return value, then throws a distinct error', () => {
        const callback = vi.fn((value: number) => value * 2);
        const wrapped = once(callback);

        expect(wrapped(3)).toBe(6);
        expect(() => wrapped(4)).toThrow(OnceConsumedError);
        expect(callback).toHaveBeenCalledExactlyOnceWith(3);
    });

    it('uses the consumer-provided message when the callback is reused', () => {
        const wrapped = once(() => undefined, 'Completion already delivered');

        wrapped();
        expect(() => wrapped()).toThrow(OnceConsumedError);
        expect(() => wrapped()).toThrow('Completion already delivered');
    });

    it('consumes the callback even when it throws', () => {
        const error = new Error('Callback failed');
        const wrapped = once(() => { throw error; });

        expect(() => wrapped()).toThrow(error);
        expect(() => wrapped()).toThrow(OnceConsumedError);
    });
});
