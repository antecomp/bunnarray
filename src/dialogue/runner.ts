import createFacesContainer from "../faces";
import createOptionsOverlay from "../options";
import { createCrossFadingTextDisplay } from "../text";
import { DialogueMatch, DialogueNode, DialogueOption } from "./types";

export type DialogueState = {
    text: string;
    face: string | undefined;
    options: DialogueOption[] | undefined;
    match: DialogueMatch | undefined,
    signals: string[] | undefined
    ended: boolean;
}

function createDialogueStateMachine(root: DialogueNode, funcs: Record<string, () => string>) {
    let current = root;

    function stateOf(node: DialogueNode): DialogueState {
        return {
            text: node.text,
            face: node.face,
            options: 'options' in node ? node.options : undefined,
            match: 'match' in node ? node.match : undefined,
            signals: node.signals,
            ended: !('next' in node && node.next) && !('options' in node) && !('match' in node)
        }
    }

    const currentState = () => stateOf(current);

    function proceed(): DialogueState {
        if ('next' in current && current.next) {
            current = current.next;
        }
        else if ('match' in current && current.match) {
            current = navigateMatch(current.match, funcs);
        }
        return stateOf(current);
    }

    function choose(index: number): DialogueState {
        if (!('options' in current)) throw new Error("No options at current node");
        const pick = current.options[index];
        if ('match' in pick) {
            current = navigateMatch(pick.match, funcs);
        } else {
            current = pick.next;
        }

        return stateOf(current);
    }

    return { proceed, choose, currentState };
}

export function navigateMatch(match: DialogueMatch, funcs: Record<string, () => string>): DialogueNode {
    const fun = funcs[match.on];
    if (!fun) throw new Error("Cannot execute match as function name has no associated mapping.");
    const res = fun();
    let branch = match.matches[res] ?? match.fallback;
    if (branch && 'on' in branch) {
        branch = navigateMatch(branch, funcs);
        return branch;
    } else if (branch === undefined) {
        throw new Error("Match branch has no destination nor fallback!");
    }
    return branch;
}

function createSignalBus() {
    const bus = new Map<string, (() => void)[]>();

    function addListener(signal: string, action: () => void) {
        const listeners = bus.get(signal) ?? [];
        listeners.push(action);
        bus.set(signal, listeners);
    }

    function removeListener(signal: string, action: () => void) {
        const listeners = bus.get(signal);
        if (!listeners) return;
        bus.set(signal,
            listeners.filter(listener => listener !== action)
        );
    }

    function emit(signal: string) {
        const listeners = bus.get(signal);
        if (!listeners) {
            console.warn("Received unhandled signal: " + signal);
            return;
        };
        listeners.forEach(listener => listener());
    }

    return { addListener, removeListener, emit };
}

function renderTextLine(text: string, varTable: Record<string, string>) {
    // Fill in variables with runtime values.
    return text.replace(/\$\w+/g, m => varTable[m.slice(1)]);
}

export default function createDialogueRunner(
    root: DialogueNode,
    deps: {
        responseText: ReturnType<typeof createCrossFadingTextDisplay>,
        optionsOverlay: ReturnType<typeof createOptionsOverlay>,
        face: Awaited<ReturnType<typeof createFacesContainer>>
    },
    matchFuncs: Record<string, () => string>,
    initialVarMap?: Record<string, string>
) {

    const stateMachine = createDialogueStateMachine(root, matchFuncs);
    const signalBus = createSignalBus();
    const varMap = new Map<string, string>(initialVarMap && Object.entries(initialVarMap));

    let busy = false;

    async function render(state: DialogueState) {
        if (busy) return;
        busy = true;

        await deps.optionsOverlay.hide();

        if (state.face) deps.face.changeTo(state.face);

        if (state.signals) state.signals.forEach(signal => signalBus.emit(signal));

        await deps.responseText.changeText(
            renderTextLine(state.text, Object.fromEntries(varMap))
        );

        if (state.options) {
            await deps.optionsOverlay.show(state.options, index => {
                if (busy) return;
                render(stateMachine.choose(index));
            });
        }

        busy = false;
    }

    function start() {
        render(stateMachine.currentState());
    }

    function proceed() {
        const state = stateMachine.currentState();
        if (state.options || state.ended || busy) return;
        render(stateMachine.proceed());
    }

    return {
        // advance, 
        start,
        proceed,
        addSignalListener: signalBus.addListener,
        removeSignalListener: signalBus.removeListener,
        setVar: (what: string, to: string) => varMap.set(what, to),
        readVar: (what: string) => varMap.get(what)
    }
}