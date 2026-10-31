type ScheduleFunction = (task: VoidFunction) => void;

export default function createTrampoline(): ScheduleFunction {
    const queue: VoidFunction[] = [];
    let busy = false;

    return task => {
        queue.push(task);
        if (busy) return; // only schedule

        busy = true; // set busy & execute.
        try {
            for (let next = queue.shift(); next; next = queue.shift()) next();
        } finally {
            busy = false;
            queue.length = 0; // wipe queue
        }
    };
}
