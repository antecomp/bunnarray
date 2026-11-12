type ScheduleFunction = (task: VoidFunction) => void;


/** 
 * Simple FIFO scheduler to run reentrate tasks in sequence.
 * Routes errors through `onError`.
 */
export default function createTrampoline(onError: (error: unknown) => void): ScheduleFunction {
    const queue: VoidFunction[] = [];
    let busy = false;

    return task => {
        queue.push(task);
        if (busy) return; // only schedule

        busy = true; // set busy & execute.
        try {
            for (let next = queue.shift(); next; next = queue.shift()) next();
        } catch (error) {
            onError(error);
        } finally {
            busy = false;
            queue.length = 0; // wipe queue
        }
    };
}
