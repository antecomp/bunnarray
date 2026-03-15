import { AvailableFace } from "../faces";

export type DialogueOption = {
    text: string;
    next: DialogueNode;
}

export type DialogueNode = {
    text: string;
    // Otherwise inherit from parent.
    face?: AvailableFace;
} & ({
    next?: DialogueNode;
} | {
    options: DialogueOption[];
});
