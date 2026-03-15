import { AvailableFace, FaceChangeFn } from "./faces"
import { ChangeTextFn } from "./text";

export type DialogueNode = {
    text: string,
    // Otherwise inherit from parent.
    face?: AvailableFace,
} & ({
    next?: DialogueNode
} | {
    options: {
        text: string,
        next: DialogueNode
    }[]
});

export const TEST_DIALOGUE: DialogueNode = {
    text: "This is the first line of text",
    face: 'smile',
    next: {
        text: 'Wow more text!',
        face: 'pleased',
        next: {
            text: 'Jeg tilintetgjør haterne mine ved å bli venn med dem.',
            next: {
                text: 'Okay that is enough text',
                face: 'weary'
            }
        }
    }
}

export default function createDialogueRunner(root: DialogueNode, deps: { changeFace: FaceChangeFn, changeText: ChangeTextFn }) {
    // TODO: Utilize promises returned by the change methods to block interaction until ready.

    let current = root;

    function renderCurrent() {
        if (current.face) deps.changeFace(current.face);
        deps.changeText(current.text);
    }

    function getCurrentOptions() {
        if (!('options' in current)) return;

        return current.options.map(option => ({
            run: () => moveTo(option.next),
            text: option.text
        }));
    }

    function moveTo(node: DialogueNode) {
        current = node;
        renderCurrent();

        return getCurrentOptions();
    }

    renderCurrent();

    function proceed() {
        if ('next' in current && current.next) {
            return moveTo(current.next);
        }

        return getCurrentOptions();
    }

    return { proceed }

}