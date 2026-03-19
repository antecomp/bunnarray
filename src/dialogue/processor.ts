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
        if (branch.nestedMatch) {
            Object.assign(labels, collectLabelsFromMatch(branch.nestedMatch));
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
    chain: UnlinkedMatch | null,
    nodes: UnlinkedNode[],
    labels: Record<string, string>
): UnlinkedMatch {
    // Build chained match first so we can pass it down to branches
    // For edge case where we have nested AND chained matches, children should inherit chain if needed.
    const chained = match.chained
        ? buildMatch(match.chained, fallback, null, nodes, labels)
        : null;

    // Branches should fall through to chained match if present, then outer fallback
    const branchChain = chained ?? chain;

    const branches: Record<string, NodeRef | UnlinkedMatch> = {};

    for (const branch of match.branches) {
        if (branch.nestedMatch) {
            // Build nested match first, then pass it as chain to body sequence.
            const unlinkedNestedMatch = buildMatch(branch.nestedMatch, fallback, branchChain, nodes, labels);
            if (branch.body.length > 0) {
                // Body exists, flatten it with nested match as chain.
                const result = flattenSequence(branch.body, fallback, unlinkedNestedMatch, nodes, labels);
                branches[branch.value] = result ?? unlinkedNestedMatch;
            } else {
                // No body - go straight to nested match
                branches[branch.value] = unlinkedNestedMatch;
            }
            continue;
        }

        const result = flattenSequence(branch.body, fallback, branchChain, nodes, labels);
        const branchRef = result ?? fallback;
        if (!branchRef && !branchChain) throw new Error("buildMatch: no branch ref or chain");
        branches[branch.value] = branchRef ?? branchChain!;
    }

    return {
        on: match.on,
        branches,
        fallback: branchChain ?? fallback ?? undefined
    }
}

// Returns first ref produced so callers can wire entry points.
function flattenSequence(
    sequence: NodeTree[],
    fallback: NodeRef | null,
    chain: UnlinkedMatch | null,
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
            const bodyFirst = flattenSequence(node.body, bodyFallback, null, nodes, labels);
            // Register label pointer at first node of body.
            if (bodyFirst?.kind === 'id') labels[node.label] = bodyFirst.value;
            continue;
        }

        const nextRef = buildNextRef(sequence, i + 1, null);
        const isLast = buildNextRef(sequence, i + 1, null) === null;

        if (node.label) labels[node.label] = node.id;

        if (node.optionBlock) {

            const unlinked: UnlinkedNode = {
                id: node.id,
                text: node.text,
                options: [] // Placeholder, read comment below.
            };

            nodes.push(unlinked);

            // Build blockMatch chain if present. Also must be after so new nodes pushed after.
            const blockChain = node.blockMatch
                ? buildMatch(node.blockMatch, nextRef, null, nodes, labels)
                : null;

            // Populate unlinked node with options after-the-fact, 
            // to prevent accidentally placing the option nodes before it in the sequence 
            // Fixes a bug with an option as root.
            if (!firstRef) firstRef = idRef(node.id);
            unlinked.options = flattenOptionBlock(
                node.optionBlock,
                node.text,
                nextRef ?? fallback, // best available fallback 
                blockChain ?? chain, // best available chain 
                nodes,
                labels
            )

            continue;
        }

        if (node.match) {
            const unlinked: UnlinkedNode = {
                id: node.id,
                text: node.text,
                match: {} as UnlinkedMatch // placeholder, se below.
            };

            nodes.push(unlinked);
            if (!firstRef) firstRef = idRef(node.id);

            // Populate after pushing to prevent branch nodes appearing before owner in sequence
            unlinked.match = buildMatch(node.match, nextRef ?? fallback, isLast ? chain : null, nodes, labels);
            if (isLast && chain && !unlinked.match.fallback) {
                unlinked.match.fallback = chain;
            }

            continue;
        }

        // Plain
        // Priority: nextRef > chain > fallback
        let unlinked: UnlinkedNode;
        if (nextRef) {
            unlinked = { id: node.id, text: node.text, next: nextRef };
        } else if (isLast && chain) {
            unlinked = { id: node.id, text: node.text, match: chain };
        } else {
            unlinked = { id: node.id, text: node.text, next: fallback };
        }

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
    chain: UnlinkedMatch | null,
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
                options: flattenOptionBlock(option.nestedOptionBlock, parentPrompt, fallback, chain, nodes, labels),
            };
            nodes.push(synthetic);
            return { text: option.text, next: idRef(syntheticId) };
        }

        // Option owns a match directly
        if (option.match) {
            return {
                text: option.text,
                match: buildMatch(option.match, fallback, chain, nodes, labels),
            };
        }

        // Normal branch
        const firstRef = flattenSequence(option.branch, fallback, chain, nodes, labels);

        // If branch is empty and we have a chain, the option leads directly to that match.
        if (!firstRef && chain) {
            return { text: option.text, match: chain }
        }

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

    flattenSequence(tree, null, null, nodes, labels);
    resolveLabels(nodes, labels);

    return nodes;
}