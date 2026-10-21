
// todo (later): consider making a mapping of line numbers
// so later chevotain errors actually display the correct original spot.
export default function preprocess(raw: string) {
    return raw
        .split(/\r?\n/)
        .filter(line => line.trim() !== '') // remove blank lines
        .map(line => line.trim()) // trim every line
        .filter(line => line.charAt(0) !== '#') // remove line comments
        .join('\n') + '\n';
}