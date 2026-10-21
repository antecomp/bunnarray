export default function createMemory(init: Record<string, string> = {}) {
    const values = new Map(Object.entries(init));

    type UpdateNotification = {
        key: string,
        prev: string | undefined;
        value: string | undefined
    }

    const listeners = new Set<(update: UpdateNotification) => void>();

    function notify(update: UpdateNotification) {
        for(const listener of [...listeners]) {
            listener(update);
        }
    }

    function set(key: string, value: string) {
        const prev = values.get(key);
        
        // if (previous === value) return;

        values.set(key, value);
        notify({key, value, prev})
    }

    function del(key: string) {
        if (!values.has(key)) return false;

        const prev = values.get(key);
        values.delete(key);

        notify({key, value: undefined, prev});
        return true;
    }

    return {
        get: (key: string) => values.get(key),
        has: (key: string) => values.has(key),
        set,
        delete: del,

        snapshot: () => Object.fromEntries(values),

        subscribe(fn: (update: UpdateNotification) => void) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        }
    }
}