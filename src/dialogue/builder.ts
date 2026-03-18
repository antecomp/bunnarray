import { DialogueMatch, DialogueNode, DialogueOption } from "./types";
import { NodeRef, UnlinkedMatch, UnlinkedNode, UnlinkedOption } from "./processor";

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

function resolveRef(ref: NodeRef | null, byId: Map<string, DialogueNode>): DialogueNode | null {
    if (!ref) return null;
    return byId.get(ref.value) ?? null;
}

export function build(nodes: UnlinkedNode[]): DialogueNode | null {
    if (nodes.length === 0) return null;

    const byId = new Map<string, DialogueNode>();

    // Pass 1: construct all DialogueNodes without wiring
    for (const node of nodes) {
        const { text, face, signals } = parseTextLine(node.text);
        byId.set(node.id, { text, face, signals } as DialogueNode);
    }

    // Pass 2: wire next, options, or match
    for (const node of nodes) {
        const dialogueNode = byId.get(node.id)!;

        if ('options' in node) {
            Object.assign(dialogueNode, {
                options: node.options.map(o => buildOption(o, byId))
            });
        } else if ('match' in node) {
            Object.assign(dialogueNode, {
                match: buildMatch(node.match, byId)
            });
        } else {
            Object.assign(dialogueNode, {
                next: resolveRef(node.next, byId)
            });
        }
    }

    return byId.get(nodes[0].id) ?? null;
}

function buildOption(
    option: UnlinkedOption,
    byId: Map<string, DialogueNode>
): DialogueOption {
    if ('match' in option) {
        return {
            text: option.text,
            match: buildMatch(option.match, byId)
        };
    }
    return {
        text: option.text,
        next: resolveRef(option.next, byId) ?? (() => { throw new Error(`Unresolved option next`); })()
    };
}

function buildMatch(
    match: UnlinkedMatch,
    byId: Map<string, DialogueNode>
): DialogueMatch {
    const matches: Record<string, DialogueNode | DialogueMatch> = {};

    for (const [value, ref] of Object.entries(match.branches)) {
        if ('kind' in ref) {
            matches[value] = resolveRef(ref, byId) ?? (() => { throw new Error(`Unresolved match branch: "${value}"`); })();
        } else {
            matches[value] = buildMatch(ref, byId);
        }
    }

    const fallback = match.fallback
        ? 'kind' in match.fallback
            ? resolveRef(match.fallback, byId) ?? undefined
            : buildMatch(match.fallback, byId)
        : undefined;

    return { on: match.on, matches, fallback };
}