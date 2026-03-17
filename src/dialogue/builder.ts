import { DialogueNode } from "./types";
import { UnlinkedNode } from "./processor";

/*
 * Lazy final parsing of actual text lines into DialogueNode shape.
 * I did not want to incorporate directives into the grammar since we can just easily extract them here.
 */
const DIRECTIVE_REGEX = /<([^:>]+):([^>]+)>/g;

function parseTextLine(line: string): DialogueNode {
    const directives: Record<string, string[]> = Object.create(null);
    const text = line.replace(DIRECTIVE_REGEX, (_, directive: string, value: string) => {
        (directives[directive] ??= []).push(value); // Side effect, save directive to handle in another pass.

        return '';
    }).trim();

    // Handle Known Directives ........................
    let face: string | undefined;
    let signals: undefined | string[];
    for (const [directive, values] of Object.entries(directives)) {
        if (directive === 'face' && face === undefined) {
            face = values[0];
        }

        if(directive === 'signal') {
            signals = values
        }
    }

    return { text, face, signals };
}

export function build(nodes: UnlinkedNode[]): DialogueNode | null {
    if (nodes.length === 0) return null;

    // Pass 1: construct all DialogueNodes without next/options wiring
    const byId = new Map<string, DialogueNode>();
    for (const node of nodes) {
        const constructedNode = parseTextLine(node.text);
        byId.set(node.id, constructedNode);
    }

    // Pass 2: wire next and options using the map
    for (const node of nodes) {
        const dialogueNode = byId.get(node.id)!;

        if (node.options) {
            Object.assign(dialogueNode, {
                options: node.options.map(o => ({
                    text: o.text,
                    next: o.next?.kind === 'id' ? byId.get(o.next.value) ?? null : null
                }))
            });
        } else {
            Object.assign(dialogueNode, {
                next: node.next?.kind === 'id' ? byId.get(node.next.value) ?? null : null
            });
        }
    }

    return byId.get(nodes[0].id) ?? null;
}
