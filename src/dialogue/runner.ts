import createFacesContainer from "../faces";
import createOptionsOverlay from "../options";
import { createCrossFadingTextDisplay } from "../text";
import { DialogueNode } from "./types";

export type DialogueState = {
    text: string;
    face?: string;
    options?: { text: string; next: DialogueNode }[];
    signals: string[] | undefined
    ended: boolean;
}

function createDialogueStateMachine(root: DialogueNode) {
    let current = root;

    function stateOf(node: DialogueNode): DialogueState {
        return {
            text: node.text,
            face: node.face,
            options: 'options' in node ? node.options : undefined,
            signals: node.signals,
            ended: !('next' in node && node.next) && !('options' in node)
        }
    }

    const currentState = () => stateOf(current);

    function proceed(): DialogueState {
        if ('next' in current && current.next) current = current.next;
        return stateOf(current);
    }

    function choose(index: number): DialogueState {
        if (!('options' in current)) throw new Error("No options at current node");
        current = current.options[index].next;
        return stateOf(current);
    }

    return { proceed, choose, currentState };
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
        if(!listeners) return;
        bus.set(signal,
            listeners.filter(listener => listener !== action)
        );
    }

    function emit(signal: string) {
        const listeners = bus.get(signal);
        if(!listeners) {
            console.warn("Received unhandled signal: " + signal);
            return;
        };
        listeners.forEach(listener => listener());
    }

    return {addListener, removeListener, emit};
}

export default function createDialogueRunner(
    root: DialogueNode,
    responseText: ReturnType<typeof createCrossFadingTextDisplay>,
    optionsOverlay: ReturnType<typeof createOptionsOverlay>,
    face: Awaited<ReturnType<typeof createFacesContainer>>
) {
    const runner = createDialogueStateMachine(root);
    const signalBus = createSignalBus();

    let busy = false;

    async function render(state: DialogueState) {
        if(busy) return;
        busy = true;

        await optionsOverlay.hide();
        if (state.face) face.changeTo(state.face);
        if(state.signals) state.signals.forEach(signal => signalBus.emit(signal));
        await responseText.changeText(state.text);

        if(state.options) {
            await optionsOverlay.show(state.options, index => {
                if(busy) return;
                render(runner.choose(index));
            });
        }

        busy = false;
    }

    function start() {
        render(runner.currentState());
    }

    function proceed() {
        const state = runner.currentState();
        if (state.options || state.ended || busy) return;
        render(runner.proceed());
    }

    return {
        // advance, 
        start, 
        proceed,
        addSignalListener: signalBus.addListener,
        removeSignalListener: signalBus.removeListener
    }
}
