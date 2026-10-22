
// todo (later): consider making a mapping of line numbers
// so later chevotain errors actually display the correct original spot.
export default function preprocess(raw: string) {
    const lines = raw
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== '' && !line.startsWith('#'));

    // Certain codes need a final newline to terminate.
    // But we shouldn't let that break empty programs.
    return lines.length ? lines.join('\n') + '\n' : '';
}