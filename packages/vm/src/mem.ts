/** A change to one VM memory entry, emitted after it is set or deleted. */
export type BnyMemoryUpdate = {
    /** Name of the changed entry. */
    key: string;
    /** Value before the change, or `undefined` if the entry was absent. */
    prev: string | undefined;
    /** New value, or `undefined` if the entry was deleted. */
    value: string | undefined;
};

/** Simple string record used to initialize or capture VM memory. */
export type BnyMemorySnapshot = Record<string, string>;
/** Receives each {@link BnyMemoryUpdate|update} made to VM memory. */
export type BnyMemoryUpdateHandler = (update: BnyMemoryUpdate) => void;

/** Read and modify the string-valued memory of a VM instance. */
export type BnyMemory = {
    /** Get a value, or `undefined` if the key is absent. */
    get: (key: string) => string | undefined;
    /** Check whether a key exists, even if its value is an empty string. */
    has: (key: string) => boolean;
    /** Set a value and emit a {@link BnyMemoryUpdate}, even if unchanged. */
    set: (key: string, value: string) => void;
    /** Delete a key and emit an update if it existed; return whether it existed. */
    delete: (key: string) => boolean;
    /** Return a copy of the current entries as a {@link BnyMemorySnapshot}. */
    snapshot: () => BnyMemorySnapshot;
};

export default function createMemory(onUpdate: BnyMemoryUpdateHandler, init: BnyMemorySnapshot = {}): BnyMemory {
    const values = new Map(Object.entries(init));

    function set(key: string, value: string) {
        const prev = values.get(key);

        values.set(key, value);
        onUpdate({ key, value, prev });
    }

    function del(key: string) {
        if (!values.has(key)) return false;

        const prev = values.get(key);
        values.delete(key);

        onUpdate({ key, value: undefined, prev });
        return true;
    }

    return {
        get: (key: string) => values.get(key),
        has: (key: string) => values.has(key),
        set,
        delete: del,

        snapshot: () => Object.fromEntries(values)
    };
}
