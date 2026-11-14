import { describe, expect, it } from 'vitest';
import createTrampoline from '../trampoline';

describe('trampoline', () => {
    it('runs each scheduled task synchronously and remains usable afterward', () => {
        const reported: unknown[] = [];
        const ran: string[] = [];
        const schedule = createTrampoline(error => reported.push(error));

        schedule(() => ran.push('first'));
        expect(ran).toEqual(['first']);

        schedule(() => ran.push('second'));
        expect(ran).toEqual(['first', 'second']);
        expect(reported).toEqual([]);
    });

    it('runs tasks scheduled during a task afterward in FIFO order', () => {
        const reported: unknown[] = [];
        const ran: string[] = [];
        const schedule = createTrampoline(error => reported.push(error));

        schedule(() => {
            ran.push('outer start');
            schedule(() => ran.push('first queued'));
            schedule(() => ran.push('second queued'));
            ran.push('outer end');
        });

        expect(ran).toEqual(['outer start', 'outer end', 'first queued', 'second queued']);
        expect(reported).toEqual([]);
    });

    it('reports a task error, discards queued tasks, and accepts later tasks', () => {
        const failure = new Error('task failed');
        const reported: unknown[] = [];
        const ran: string[] = [];
        const schedule = createTrampoline(error => reported.push(error));

        schedule(() => {
            ran.push('first');
            schedule(() => ran.push('discarded'));
            throw failure;
        });

        expect(reported).toEqual([failure]);
        expect(ran).toEqual(['first']);

        schedule(() => ran.push('later'));
        expect(ran).toEqual(['first', 'later']);
    });

    it('clears the queue and resets scheduling when the error handler throws', () => {
        const handlerFailure = new Error('error handler failed');
        const ran: string[] = [];
        const schedule = createTrampoline(() => { throw handlerFailure; });

        expect(() => schedule(() => {
            schedule(() => ran.push('discarded'));
            throw new Error('task failed');
        })).toThrow(handlerFailure);
        expect(ran).toEqual([]);

        schedule(() => ran.push('later'));
        expect(ran).toEqual(['later']);
    });
});
