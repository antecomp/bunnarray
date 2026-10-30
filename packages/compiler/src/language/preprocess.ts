
export default function preprocess(raw: string) {
    const normalized = raw.replace(/\r\n?/g, '\n');

    // Certain codes need a final newline to terminate.
    // But we shouldn't let that break empty programs.
    return normalized && !normalized.endsWith('\n') ? normalized + '\n' : normalized;
}
