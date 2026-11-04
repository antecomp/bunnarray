export type BnyMemoryUpdate = {
    key: string;
    prev: string | undefined;
    value: string | undefined;
};

export type BnyMemorySnapshot = Record<string, string>;
export type BnyMemoryUpdateHandler = (update: BnyMemoryUpdate) => void;

export type BnyMemory = {
    get: (key: string) => string | undefined;
    has: (key: string) => boolean;
    set: (key: string, value: string) => void;
    delete: (key: string) => boolean;
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
