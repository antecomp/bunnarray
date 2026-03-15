import createFacesContainer, { AvailableFace } from "../faces";
import createOptionsOverlay from "../options";
import { createCrossFadingTextDisplay } from "../text";
import { DialogueNode } from "./types";

export type DialogueState = {
    text: string;
    face?: AvailableFace;
    options?: { text: string; next: DialogueNode }[];
    ended: boolean;
}

export function createDialogueRunner(root: DialogueNode) {
    let current = root;

    function stateOf(node: DialogueNode): DialogueState {
        return {
            text: node.text,
            face: node.face,
            options: 'options' in node ? node.options : undefined,
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

export default function createDialogueAdvancer(
    runner: ReturnType<typeof createDialogueRunner>,
    responseText: ReturnType<typeof createCrossFadingTextDisplay>,
    optionsOverlay: ReturnType<typeof createOptionsOverlay>,
    face: Awaited<ReturnType<typeof createFacesContainer>>
) {
    let busy = false;

    async function advance(state: DialogueState) {
        if(busy) return;
        busy = true;

        await optionsOverlay.hide();
        if (state.face) face.changeTo(state.face);
        await responseText.changeText(state.text);

        if(state.options) {
            await optionsOverlay.show(state.options, index => {
                if(busy) return;
                advance(runner.choose(index));
            });
        }

        busy = false;
    }

    function start() {
        advance(runner.currentState());
    }

    function proceed() {
        const state = runner.currentState();
        if (state.options || state.ended || busy) return;
        advance(runner.proceed());
    }

    return {
        // advance, 
        start, 
        proceed
    }
}