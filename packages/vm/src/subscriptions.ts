export default function createSubscriptions<T>() {
    const listeners = new Set<(value: T) => void>();

    function notify(value: T) {
        for (const listener of [...listeners]) {
            listener(value);
        }
    }

    function subscribe(listener: (value: T) => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    return { notify, subscribe };
}
