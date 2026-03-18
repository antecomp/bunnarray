/*
dialogue    -> statement*
statement   -> textNode | goto | skipBlock
goto        → Goto Text Newline?
textNode    → (Label Text Newline)? Text (optionBlock | Newline matchBlock | Newline?) 
optionBlock → BlockOpen Newline choice+ BlockClose Newline?
choice      → Option Text (optionBlock | matchBlock | Newline statement*)
skipBlock   → SkipBlockOpen Text CloseBracket Newline statement* SkipBlockClose Newline?
matchBlock  → MatchBlockOpen Text CloseBracket Newline matchBranch+ MatchBlockClose Newline? matchBlock?
matchBranch → Equals Text Newline (matchBlock |statement)*
*/

import { CstParser } from "chevrotain";
import {
    BlockClose, BlockOpen, CloseBracket, Equals, Goto, Label,
    MatchBlockClose, MatchBlockOpen, Newline,
    Option, SkipBlockClose, SkipBlockOpen, Text
} from "./lexer";


export class DialogueParser extends CstParser {
    constructor() {
        super([
            BlockClose, BlockOpen, CloseBracket, Equals, Goto, Label,
            MatchBlockClose, MatchBlockOpen, Newline,
            Option, SkipBlockClose, SkipBlockOpen, Text
        ]);
        this.performSelfAnalysis();
    }

    dialogue = this.RULE("dialogue", () => {
        this.MANY(() => this.SUBRULE(this.statement))
    });

    statement = this.RULE("statement", () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.textNode) },
            { ALT: () => this.SUBRULE(this.goto) },
            { ALT: () => this.SUBRULE(this.skipBlock) },
            // { ALT: () => this.SUBRULE(this.matchBlock) },
        ]);
    });

    goto = this.RULE("goto", () => {
        this.CONSUME(Goto);
        this.CONSUME(Text);
        this.OPTION(() => this.CONSUME(Newline)); // optional trailing newline for EOF
    });

    textNode = this.RULE("textNode", () => {
        // Optional leading @label
        this.OPTION(() => {
            this.CONSUME(Label);
            this.CONSUME1(Text);
            this.CONSUME1(Newline);
        });
        this.CONSUME2(Text);

        this.OR([
            { ALT: () => this.SUBRULE(this.optionBlock) }, // Must be on same line.
            {
                ALT: () => {
                    this.CONSUME2(Newline) // required newline for matchBlock owned by this node.
                    this.SUBRULE(this.matchBlock)
                }
            }, // Otherwise an optional newline, either will move into the next statement, or just terminate.
            { ALT: () => this.OPTION2(() => this.CONSUME3(Newline))}
        ]);
    });

    optionBlock = this.RULE("optionBlock", () => {
        this.CONSUME(BlockOpen);
        this.CONSUME(Newline);
        this.MANY(() => this.SUBRULE(this.choice));
        this.CONSUME(BlockClose);
        this.OPTION2(() => this.CONSUME2(Newline));  // optional trailing newline for EOF
    });

    choice = this.RULE("choice", () => {
        this.CONSUME(Option);
        this.CONSUME(Text);
        this.OR([
            // Must be immediately followed by optionBlock (no newline)
            { ALT: () => this.SUBRULE(this.optionBlock) },
            // Can be immediately followed by matchBlock (may remove)
            { ALT: () => this.SUBRULE(this.matchBlock) },
            // Remaining statements require a new line break to distinguish between option text
            {
                ALT: () => {
                    this.CONSUME(Newline)
                    this.MANY(() => this.SUBRULE(this.statement))
                }
            }
        ]);
    });

    skipBlock = this.RULE("skipBlock", () => {
        this.CONSUME(SkipBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
        this.CONSUME2(Newline);
        this.MANY(() => this.SUBRULE(this.statement));
        this.CONSUME(SkipBlockClose);
        this.OPTION2(() => this.CONSUME3(Newline));
    })

    matchBlock = this.RULE("matchBlock", () => {
        this.CONSUME(MatchBlockOpen);
        this.CONSUME(Text);
        this.CONSUME(CloseBracket);
        this.CONSUME1(Newline);
        this.MANY1(() => this.SUBRULE(this.matchBranch));
        this.CONSUME(MatchBlockClose);
        this.OPTION2(() => this.CONSUME2(Newline));
        this.OPTION3(() => this.SUBRULE(this.matchBlock));
    });

    matchBranch = this.RULE("matchBranch", () => {
        this.CONSUME(Equals);
        this.CONSUME(Text);
        this.CONSUME(Newline);
        this.OR([
            {ALT: () => this.SUBRULE(this.matchBlock)},
            {ALT: () => this.MANY(() => this.SUBRULE(this.statement))}
        ]);
    });
}