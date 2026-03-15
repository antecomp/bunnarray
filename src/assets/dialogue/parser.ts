/*
dialogue    -> statement*
statement   -> textNode | goto
goto        -> Goto Text Newline
textNode    -> (Label Text Newline)? Text (optionBlock | Newline)
option      -> Option Text (optionBlock | Newline statement*)
optionBlock -> Newline? BlockOpen Newline option+ BlockClose Newline

Plus a bunch of bs to make Newline optional actually for EOF because im dumb
*/

import { CstParser } from "chevrotain";
import { BlockClose, BlockOpen, Equals, Goto, Label, Newline, Text, Option } from "./lexer";

export class DialogueParser extends CstParser {
    constructor() {
        super([Text, Label, Goto, Option, BlockOpen, BlockClose, Newline, Equals]);
        this.performSelfAnalysis();
    }

    dialogue = this.RULE("dialogue", () => {
        this.OPTION(() => this.CONSUME(Newline));  // leading newline
        this.MANY(() => this.SUBRULE(this.statement))
        // this.OPTION2(() => this.CONSUME2(Newline)); // Trailing newline (do we need this?)
    });

    statement = this.RULE("statement", () => {
        this.OR([
            {ALT: () => this.SUBRULE(this.textNode)},
            {ALT: () => this.SUBRULE(this.goto)}
        ]);
    });

    goto = this.RULE("goto", () => {
        this.CONSUME(Goto);
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline)); // optional trailing newline for EOF
    });

    textNode = this.RULE("textNode", () => {
        this.OPTION(() => {
            this.CONSUME(Label);
            this.CONSUME1(Text);
            this.CONSUME1(Newline);
        });
        this.CONSUME2(Text);
        this.OR([
            {ALT: () => this.SUBRULE(this.optionBlock)},
            { ALT: () => this.OPTION2(() => this.CONSUME2(Newline)) }, // optional trailing newline for EOF
        ]);
    });

    optionBlock = this.RULE("optionBlock", () => {
        this.OPTION(() => this.CONSUME1(Newline));
        this.CONSUME(BlockOpen);
        this.CONSUME2(Newline);
        this.MANY(() => this.SUBRULE(this.choice));
        this.CONSUME(BlockClose);
        this.OPTION2(() => this.CONSUME3(Newline));  // optional trailing newline for EOF
    });

    choice = this.RULE("choice", () => {
        this.CONSUME(Option);
        this.CONSUME(Text);
        this.OR([
            {ALT: () => this.SUBRULE(this.optionBlock)},
            {ALT: () => {
                this.CONSUME(Newline);
                this.MANY(() => this.SUBRULE(this.statement));
            }}
        ]);
    });
}