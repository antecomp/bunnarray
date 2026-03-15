/*
Faux AST, Initial visit run through CST to generate something easier to work with.
Mirrors grammar/CST shape generally but with clean objects.
*/

export type GotoTree = {
    kind: 'goto';
    id: string;
    target: string;           // label name, unresolved
};

export type TextTree = {
    kind: 'text';
    id: string;
    text: string;             // raw, face tag still inside
    label?: string;           // @name if present
    block?: OptionTree[];     // present if followed by an option block
};

export type NodeTree = TextTree | GotoTree;

export type OptionTree = {
    text: string;
    branch: NodeTree[];       // empty if this is a chained option
    nestedBlock?: OptionTree[]; // present if option immediately opens a block
};


import { generateId } from "./genid";
import { DialogueParser } from "./parser";

const parser = new DialogueParser();
const BaseVisitor = parser.getBaseCstVisitorConstructor();

export class DialogueVisitor extends BaseVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    dialogue(ctx: any): NodeTree[] {
        return (ctx.statement ?? []).map((s: any) => this.visit(s));
    }

    statement(ctx: any): NodeTree {
        if (ctx.textNode) return this.visit(ctx.textNode[0]);
        if (ctx.goto) return this.visit(ctx.goto[0]);
        throw new Error("Unknown statement type");
    }

    textNode(ctx: any): TextTree {
        const hasLabel = !!ctx.Label;
        const labelName = hasLabel ? ctx.Text[0].image.trim() : undefined;
        const text = hasLabel ? ctx.Text[1].image.trim() : ctx.Text[0].image.trim();

        const node: TextTree = {
            kind: 'text',
            id: generateId(),
            text,
            label: labelName,
        };

        if (ctx.optionBlock) {
            node.block = this.visit(ctx.optionBlock[0]);
        }

        return node;
    }

    optionBlock(ctx: any): OptionTree[] {
        return (ctx.choice ?? []).map((c: any) => this.visit(c));
    }


    choice(ctx: any): OptionTree {
        const text = ctx.Text[0].image.trim();

        // Chained block case: ?: text {    no statements, just a nested block
        // will generate interspersed node later.
        if (ctx.optionBlock && (!ctx.statement || ctx.statement.length === 0)) {
            return {
                text,
                branch: [],
                nestedBlock: this.visit(ctx.optionBlock[0]),
            };
        }

        // Normal case: statements optionally followed by a block
        const branch = (ctx.statement ?? []).map((s: any) => this.visit(s));

        return { text, branch };
    }

    goto(ctx: any): GotoTree {
        return {
            kind: 'goto',
            id: generateId(),
            target: ctx.Text[0].image.trim(),
        };
    }

}
