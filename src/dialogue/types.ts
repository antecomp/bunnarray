import { AvailableFace } from "../faces";


export type DialogueNode = {
    text: string;
    // Otherwise inherit from parent.
    face?: AvailableFace;
} & ({
    next?: DialogueNode;
} | {
    options: {
        text: string;
        next: DialogueNode;
    }[];
});
