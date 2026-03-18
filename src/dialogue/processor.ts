// Immediate Representation - Takes simplified tree from Visitor and flattens it into plain set of UnlinkedNodes.
// UnlinkedNodes track connections with IDs, that will then be converted into proper DialogueNodes and linked later.

import { generateId } from "./genid";
import { MatchTree, NodeTree, OptionTree } from "./visitor";

export type NodeRef =
    | { kind: 'id', value: string }
    | { kind: 'label', value: string }

export type UnlinkedMatch = {
    on: string;
    branches: Record<string, NodeRef | UnlinkedMatch>;
    fallback?: NodeRef | UnlinkedMatch;
    chained?: UnlinkedMatch;
}

export type UnlinkedOption = {
    text: string;
} & (
        | { next: NodeRef | null }
        | { match: UnlinkedMatch }
    );

export type UnlinkedNode = {
    id: string;
    text: string;
} & (
        | { next: NodeRef | null }
        | { options: UnlinkedOption[] }
        | { match: UnlinkedMatch }
    );

function idRef(value: string): NodeRef {
    return { kind: 'id', value }
}

function labelRef(value: string): NodeRef {
    return { kind: 'label', value };
}

// Collect all labels in one run.
function collectLabels(sequence: NodeTree[]): Record<string, string> {
    const labels: Record<string, string> = {};

    for (const node of sequence) {
        if (node.kind == 'text') {
            if (node.label) labels[node.label] = node.id;
            if (node.optionBlock) {
                for (const option of node.optionBlock) {
                    Object.assign(labels, collectLabels(option.branch));
                    if (option.nestedOptionBlock) {
                        for (const nested of option.nestedOptionBlock) {
                            Object.assign(labels, collectLabels(nested.branch));
                        }
                    }
                }
            }
            if (node.match) {
                Object.assign(labels, collectLabelsFromMatch(node.match));
            }
        }
        if (node.kind == 'skipBlock') {
            Object.assign(labels, collectLabels(node.body))
        }
    }

    return labels;
}

function collectLabelsFromMatch(match: MatchTree): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const branch of match.branches) {
        Object.assign(labels, collectLabels(branch.body));
        if (branch.match) {
            Object.assign(labels, collectLabelsFromMatch(branch.match));
        }
    }
    if (match.chained) {
        Object.assign(labels, collectLabelsFromMatch(match.chained));
    }

    return labels;
}

// Scans forward to find next meaningful ref.
function buildNextRef(
    sequence: NodeTree[],
    fromIndex: number,
    fallback: NodeRef | null
): NodeRef | null {
    for (let i = fromIndex; i < sequence.length; i++) {
        const node = sequence[i];
        if (node.kind === 'text') return idRef(node.id);
        if (node.kind === 'goto') return labelRef(node.target);
        if (node.kind === 'skipBlock') continue;
    }
    return fallback;
}

// Match building
function buildMatch(
    match: MatchTree,
    fallback: NodeRef | null,
    nodes: UnlinkedNode[],
    labels: Record<string, string>
): UnlinkedMatch {
    const branches: Record<string, NodeRef | UnlinkedMatch> = {};

    for (const branch of match.branches) {
        // Branch owns a match directly. No body.
        if (branch.match) {
            branches[branch.value] = buildMatch(branch.match, fallback, nodes, labels);
            continue;
        }

        // Normal branch, flatten body and get first ref.
        const result = flattenSequence(branch.body, fallback, nodes, labels);
        const branchRef = result ?? fallback;
        if(!branchRef) throw new Error("You should never see this, buildMatch.")
        branches[branch.value] = branchRef;
    }

    // Chained match becomes fallback for this match
    const chained = match.chained
        ? buildMatch(match.chained, fallback, nodes, labels)
        : undefined;

    return {
        on: match.on,
        branches,
        fallback: chained ?? fallback ?? undefined
    }
}

// Returns first ref produced so callers can wire entry points.
function flattenSequence(
    sequence: NodeTree[],
    fallback: NodeRef | null,
    nodes: UnlinkedNode[],
    labels: Record<string, string>
): NodeRef | null {
    let firstRef: NodeRef | null = null;

    for (let i = 0; i < sequence.length; i++) {
        const node = sequence[i];

        if (node.kind === 'goto') continue;

        if (node.kind === 'skipBlock') {
            // Transparent to surrounding chain.
            // Body gets flattened with surrounding next as fallback.
            const bodyFallback = buildNextRef(sequence, i + 1, fallback);
            const bodyFirst = flattenSequence(node.body, bodyFallback, nodes, labels);
            // Register label pointer at first node of body.
            if (bodyFirst?.kind === 'id') labels[node.label] = bodyFirst.value;
            continue;
        }

        const nextRef = buildNextRef(sequence, i + 1, fallback);

        if (node.label) labels[node.label] = node.id;

        if (node.optionBlock) {
            const unlinked: UnlinkedNode = {
                id: node.id,
                text: node.text,
                options: flattenOptionBlock(node.optionBlock, node.text, nextRef, nodes, labels),
            };
            nodes.push(unlinked);
            if (!firstRef) firstRef = idRef(node.id);
            continue;
        }

        if (node.match) {
            const unlinked: UnlinkedNode = {
                id: node.id,
                text: node.text,
                match: buildMatch(node.match, nextRef, nodes, labels)
            };
            nodes.push(unlinked);
            if (!firstRef) firstRef = idRef(node.id);
            continue;
        }

        // Plain
        const unlinked: UnlinkedNode = {
            id: node.id,
            text: node.text,
            next: nextRef
        };
        nodes.push(unlinked);
        if (!firstRef) firstRef = idRef(node.id);
    }

    // If sequence is just a goto, just pass that as the ref.
    const last = sequence[sequence.length - 1];
    if (last?.kind === 'goto' && !firstRef) {
        firstRef = labelRef(last.target);
    }

    return firstRef;
}

function flattenOptionBlock(
    block: OptionTree[],
    parentPrompt: string,
    fallback: NodeRef | null,
    nodes: UnlinkedNode[],
    labels: Record<string, string>
): UnlinkedOption[] {
    return block.map(option => {
        // Chained block — synthesize node reusing parent prompt
        if (option.nestedOptionBlock) {
            const syntheticId = generateId();
            const synthetic: UnlinkedNode = {
                id: syntheticId,
                text: parentPrompt,
                options: flattenOptionBlock(option.nestedOptionBlock, parentPrompt, fallback, nodes, labels),
            };
            nodes.push(synthetic);
            return { text: option.text, next: idRef(syntheticId) };
        }

        // Option owns a match directly
        if (option.match) {
            return {
                text: option.text,
                match: buildMatch(option.match, fallback, nodes, labels),
            };
        }

        // Normal branch
        const firstRef = flattenSequence(option.branch, fallback, nodes, labels);
        return { text: option.text, next: firstRef ?? fallback };
    });
}

function resolveRef(ref: NodeRef | null | undefined, labels: Record<string, string>): NodeRef | null {
    if (!ref) return null;
    if (ref.kind === 'id') return ref;
    if (!labels[ref.value]) throw new Error(`Unresolved label: "${ref.value}"`);
    return idRef(labels[ref.value]);
}

function resolveUnlinkedMatch(match: UnlinkedMatch, labels: Record<string, string>): UnlinkedMatch {
    const resolved: Record<string, NodeRef | UnlinkedMatch> = {};
    for (const [value, ref] of Object.entries(match.branches)) {
        if ('kind' in ref) {
            resolved[value] = resolveRef(ref, labels) ?? { kind: 'id', value: '' };
        } else {
            resolved[value] = resolveUnlinkedMatch(ref, labels);
        }
    }
    return {
        on: match.on,
        branches: resolved,
        fallback: match.fallback
            ? 'kind' in match.fallback
                ? resolveRef(match.fallback, labels) ?? undefined
                : resolveUnlinkedMatch(match.fallback, labels)
            : undefined,
    };
}

function resolveLabels(nodes: UnlinkedNode[], labels: Record<string, string>): void {
    for (const node of nodes) {
        if ('next' in node) {
            node.next = resolveRef(node.next, labels);
        }
        if ('options' in node) {
            for (const option of node.options) {
                if ('next' in option) {
                    option.next = resolveRef(option.next, labels);
                }
            }
        }
        if ('match' in node) {
            node.match = resolveUnlinkedMatch(node.match, labels);
        }
    }
}

export function flatten(tree: NodeTree[]): UnlinkedNode[] {
    const nodes: UnlinkedNode[] = [];
    const labels = collectLabels(tree);

    flattenSequence(tree, null, nodes, labels);
    resolveLabels(nodes, labels);

    return nodes;
}