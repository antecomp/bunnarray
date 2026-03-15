import { AvailableFace } from "../faces";
import { DialogueNode } from "./types";

export type DialogueState = {
    text: string;
    face?: AvailableFace;
    options?: { text: string; next: DialogueNode }[];
    ended: boolean;
}

export default function createDialogueRunner(root: DialogueNode) {
    let current = root;

    function stateOf(node: DialogueNode): DialogueState {
        return {
            text: node.text,
            face: node.face,
            options: 'options' in node ? node.options : undefined,
            ended: !('next' in node) && !('options' in node)
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

    return {proceed, choose, currentState};
}