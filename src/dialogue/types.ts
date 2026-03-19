export type DialogueOption = {
    text: string;

} & (
    | { next: DialogueNode; }
    | { match: DialogueMatch }
)

export type DialogueMatch = {
    on: string,
    matches: {
        [match: string]: DialogueNode | DialogueMatch | undefined
    }
    fallback?:
        | DialogueNode // fallback to some dialogue node on no match
        | DialogueMatch // allow chaining of different matches
}

export type DialogueNode = {
    text: string;
    // Optional, will inherit from parent (i.e be unchanged) if undefined.
    face: string | undefined;
    // Signal response handled by runner.
    signals: string[] | undefined
} & (
    | { next?: DialogueNode; }
    | { options: DialogueOption[]; }
    | { match: DialogueMatch }
);
