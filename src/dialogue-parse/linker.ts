/*
Need a second pass to link gotos and references. (Fill in parser placeholders)
This also includes attaching the fallthroughs on options with no GOTO.
*/

import { GotoPlaceholder, LinkedNode, ParsedNode } from "./parser";

export type LabelMap = Record<string, LinkedNode | null>;

function isGoto(node: ParsedNode): node is GotoPlaceholder {
    return '_goto' in node;
}

function resolveLinkedNode(
    node: ParsedNode | null | undefined,
    labelMap: LabelMap
): LinkedNode | null {
    if (!node) return null;
    if (isGoto(node)) return node._resolvedTarget ?? labelMap[node._goto] ?? null;
    return node as LinkedNode;
}

// Follows a goto placeholder to its resolved target, or returns the node as-is.
export function resolveNext(
    node: ParsedNode | null | undefined,
): LinkedNode | null {
    if (!node) return null;
    if (isGoto(node)) return node._resolvedTarget ?? null;
    return node as LinkedNode;
}

export function firstNodeOf(
    nodes: ParsedNode[],
): LinkedNode | null {
    for (const n of nodes) {
        return resolveNext(n);
    }
    return null;
}

export function createLabelMap(
    parsedLabels: Record<string, ParsedNode> // {[label: string]: ParsedNode it points to}
): LabelMap {
    const labelMap: LabelMap = {};
    for(const [label, node] of Object.entries(parsedLabels)) {
        labelMap[label] = resolveNext(node);
    }
    return labelMap;
}

// Actual Wiring
export function linkNodes(
    nodes: ParsedNode[],
    fallthrough: LinkedNode | null,
    labelMap: LabelMap
): void {
    for(let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        const nextNode = 
            resolveLinkedNode(nodes[i+1], labelMap) // Have a following node in the same sequence.
            ?? fallthrough                          // End of sequence, is there a fallthrough?
            ?? null;                                // Truly at the end of the dialogue.

        // Node is a goto, resolve target and place in.
        if(isGoto(node)) {
            // Resolve goto placeholder - actually node ref comes from labelMap
            node._resolvedTarget = labelMap[node._goto] ?? null;
            continue;
        }

        if(node.options) {
            // For each option branch, the fallthrough is nextNode (node after BLOCK CLOSE)
            for (const option of node.options) {
                // The next (which comes after this whole options block) is the fallback...
                linkNodes(option.nodes, nextNode, labelMap);

                // Wire option.next to the first real node in its branch, or to the fallthrough
                option.next = firstNodeOf(option.nodes) ?? nextNode; 

                // Node itself has no next, options are used instead...
            }
        } else {
            // Plain text node: point to whatever comes after it.
            node.next = nextNode;
        }
    }
}
