import { DialogueNode } from "./types";
import { AvailableFace } from "../faces";
import { UnlinkedNode } from "./processor";

// Lazy, but good enough lol. I don't want to make a grammar for like 2 special notations in a text line type.
function parseTextLine(line: string): DialogueNode {
    const faceRgx = /\<face:.+?\>/
    const faceMatches = (line.match(faceRgx) ?? []).map(match => match.replace(/\<face:|\>/g, ''));
    return { text: line.replace(faceRgx, '').trim(), face: faceMatches[0] as AvailableFace }
}

export function build(nodes: UnlinkedNode[]): DialogueNode | null {
    if (nodes.length === 0) return null;

    // Pass 1: construct all DialogueNodes without next/options wiring
    const byId = new Map<string, DialogueNode>();
    for (const node of nodes) {
        const { text, face } = parseTextLine(node.text);
        byId.set(node.id, { text, face } as DialogueNode);
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