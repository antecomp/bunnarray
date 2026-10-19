import type * as A from './ast'

import { DialogueParser } from "./parser";
const parser = new DialogueParser();
const BaseVisitor = parser.getBaseCstVisitorConstructor();

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
            statements: (ctx.statement ?? []).map((node: any) => this.visit(node))
        };
    }

    statement(ctx: any): A.Statement {
        const node =
            ctx.say?.[0] ?? ctx.choice?.[0] ?? ctx.match?.[0] ??
            ctx.skip?.[0] ?? ctx.label?.[0] ?? ctx.goto?.[0];

        return this.visit(node);
    }
}

