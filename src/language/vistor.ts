import type * as A from './ast'

import { DialogueParser } from "./parser";
const parser = new DialogueParser();
const BaseVisitor = parser.getBaseCstVisitorConstructor();

const escapedCharacters: Record<string, string> = {
    lbrack: '[',
    rbrack: ']',
    lbrace: '{',
    rbrace: '}',
    amp: '&',
};

function decodeText(text: string): string {
    return text.replace(/&(lbrack|rbrack|lbrace|rbrace|amp);/g,
        (_, name: string) => escapedCharacters[name]);
}

/* visit looks at the node type (name) and calls the corresponding function
this function is passed the children of that node (coventially called ctx)

children has keys named after the matched parser rules or tokens, and each value is an array.
    - MANY and AT_LEAST_ONE can put several items in that array.
    - A single SUBRULE or CONSUME gives you a one-item array, so you use [0].
    - Optional rules and alternatives may leave a key absent, so use ?.[0] or ?? [] where appropriate.
*/

export class DialogueVisitor extends BaseVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    dialogue(ctx: any): A.DialogueAST {
        return {
            type: 'dialogue',
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        };
    }

    statement(ctx: any): A.Statement {
        const node =
            ctx.say?.[0] ?? ctx.choice?.[0] ?? ctx.match?.[0] ??
            ctx.skip?.[0] ?? ctx.label?.[0] ?? ctx.goto?.[0];

        return this.visit(node);
    }

    say(ctx: any): A.SayStatement {
        return {
            type: 'say',
            text: decodeText(ctx.Text[0].image.trim())
        }
    }

    choice(ctx: any): A.ChoiceStatement {
        return {
            type: 'choice',
            branches: (ctx.choiceBranch ?? []).map((branch: any) => this.visit(branch))
        }
    }

    choiceBranch(ctx: any): A.ChoiceBranch {
        return {
            type: 'choiceBranch',
            text: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        }
    }

    match(ctx: any): A.MatchStatement {
        return {
            type: 'match',
            on: decodeText(ctx.Text[0].image.trim()),
            branches: (ctx.matchBranch ?? []).map((branch: any) => this.visit(branch))
        }
    }

    matchBranch(ctx: any): A.MatchBranch {
        return {
            type: 'matchBranch',
            case: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        }
    }

    skip(ctx: any): A.SkipStatement {
        return {
            type: 'skip',
            label: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        }
    }

    label(ctx: any): A.LabelStatement {
        return {
            type: 'label',
            name: decodeText(ctx.Text[0].image.trim())
        }
    }

    goto(ctx: any): A.GotoStatement {
        return {
            type: 'goto',
            target: decodeText(ctx.Text[0].image.trim())
        }
    }
}

