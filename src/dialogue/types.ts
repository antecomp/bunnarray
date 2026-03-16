export type DialogueOption = {
    text: string;
    next: DialogueNode;
}

export type DialogueNode = {
    text: string;
    // Optional, will inherit from parent (i.e be unchanged) if undefined.
    face: string | undefined;
    // Signal response handled by runner.
    signals: string[] | undefined
} & ({
    next?: DialogueNode;
} | {
    options: DialogueOption[];
});
