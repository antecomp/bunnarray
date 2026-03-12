/** Utility type to force TypeScript to suggest some strings first, but allow any strings */
export type SuggestedString<T extends string> = T | (string & {});