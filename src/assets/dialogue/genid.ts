let idCounter = 0;
export function generateId(): string {
    return `node_${idCounter++}`;
}

export function resetIdCounter(): void {
    idCounter = 0;
}