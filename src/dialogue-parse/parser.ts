/* 
 Configures an intermediatary annotated tree, that has yet to all linked together
 into the complete dialogue graph (e.g gotos are set with placeholders)
*/

import { Token } from "./tokenizer";

export type GotoPlaceholder = {
    _goto: string,
    _resolvedTarget?: LinkedNode | null;
}

export type ParsedOption = {
    text: string;
    nodes: ParsedNode[];
    next?: LinkedNode | null; // filled in by linker
}

export type ParsedNode = GotoPlaceholder | {
    text: string;
    options?: ParsedOption[];
    next?: LinkedNode | null; // filled in by linker
}

// Final linked node shape, matching DialogueNode. Likely redundant but
// will keep it this way just in case I do any additional parsing passes on the node content itself.
export type LinkedNode = {
    text: string;
} & (
        | { next: LinkedNode | null }
        | { options: { text: string; next: LinkedNode | null }[] }
    );

type SequenceResult = {
    nodes: ParsedNode[];
    endIndex: number
    // Any @labels encountered map directly to the node that followed them.
    // Collected here so we can build labelMap without another pass.
    labels: Record<string, ParsedNode>
};

type OptionsResult = { options: ParsedOption[]; endIndex: number };

// Linear run of dialogue nodes, escaped when we hit an option or a block close. 
// Also Returns the index it stopped at to continue tracking with other behaviors
export function parseSequence(tokens: Token[], i: number): SequenceResult {
    const nodes: ParsedNode[] = [];
    // this setup will of course only preserve labels at the top level.
    // which is what we want anyways (dont put labels in the middle of a block, that makes little logical sense)
    const labels: Record<string, ParsedNode> = {};
    let pendingLabel: string | null = null;

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok.type == 'BLOCK_CLOSE' || tok.type == 'OPTION') {
            // Callers responsibility - Not a sequence.
            break;
        }

        if (tok.type == 'LABEL') {
            // Store label name and apply it to the next node we create.
            pendingLabel = tok.label;
            i++;
            continue; // Labels just advance to some subsequent node (and will label). Keep going.
        }

        if (tok.type == 'GOTO') {
            nodes.push({ _goto: tok.label }); // Placeholder, filled in by linker later.
            i++;
            break; // A goto ends the sequence.
        }

        if (tok.type == 'TEXT') {
            const node: ParsedNode = { text: tok.text };

            // If a label was pending, point it at this node.
            if (pendingLabel !== null) {
                labels[pendingLabel] = node;
                pendingLabel = null;
            }

            // Peek ahead: if the very next token is a BLOCK_OPEN, this node owns that options block.
            if (tokens[i + 1]?.type === 'BLOCK_OPEN') {
                const { options, endIndex } = parseOptions(tokens, i + 2); // Skip the {
                node.options = options;
                i = endIndex; // endIndex points just past the closing }
            } else {
                i++;
            }

            nodes.push(node);
        }
    }

    return { nodes, endIndex: i, labels }
}

// Reads the inside of a { block }, collecting each ?: branch and its associated sequence.
// Returns an array of option objects and the index just past the closing } (to be used by parseSequence above)
function parseOptions(tokens: Token[], i: number): OptionsResult {
    const options: ParsedOption[] = [];

    while (i < tokens.length) {
        const tok = tokens[i];

        if (tok.type === 'BLOCK_CLOSE') {
            i++; // consume the }
            break;
        }

        if (tok.type === 'OPTION') {
            const optionText = tok.text;
            i++; // consume ?:

            // Parse whatever follows this option until the next OPTION or BLOCK_CLOSE.
            const { nodes, endIndex } = parseSequence(tokens, i);
            i = endIndex;

            options.push({ text: optionText, nodes });
        } else {
            i++; // Skip anything unexpected (consider adding log here to make sure parser or tokenizer isn't messing up)
        }
    }

    return { options, endIndex: i }
}