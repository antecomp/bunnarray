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
    optionBlock?: OptionTree[];     // present if followed by an option block
    match?: MatchTree
};

export type MatchTree = {
    on: string;
    branches: MatchBranch[];
    chained?: MatchTree;
};

export type MatchBranch = {
    value: string;
    body: NodeTree[];
    match: MatchTree | undefined // nested match.
};

export type OptionTree = {
    text: string;
    branch: NodeTree[];
    nestedOptionBlock?: OptionTree[];
    match?: MatchTree;
};

export type SkipBlockTree = {
    kind: 'skipBlock',
    label: string;
    body: NodeTree[]
}

export type NodeTree = TextTree | GotoTree | SkipBlockTree;


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
        if (ctx.skipBlock) return this.visit(ctx.skipBlock[0]);
        // if (ctx.matchBlock) return this.visit(ctx.matchBlock[0]);
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
            node.optionBlock = this.visit(ctx.optionBlock[0]);
        }

        if (ctx.matchBlock) {
            node.match = (this.visit(ctx.matchBlock[0]));
        }

        return node;
    }

    goto(ctx: any): GotoTree {
        return {
            kind: 'goto',
            id: generateId(),
            target: ctx.Text[0].image.trim(),
        };
    }

    optionBlock(ctx: any): OptionTree[] {
        return (ctx.choice ?? []).map((c: any) => this.visit(c));
    }

    choice(ctx: any): OptionTree {
        const text = ctx.Text[0].image.trim();

        // Chained block - option immediately opens a nested block.
        if (ctx.optionBlock && (!ctx.statement || ctx.statement.length === 0)) {
            return {
                text,
                branch: [],
                nestedOptionBlock: this.visit(ctx.optionBlock[0]),
            };
        }

        // Owns a match block directly.
        if(ctx.matchBlock && (!ctx.statement || ctx.statement.length === 0)) {
            return {
                text,
                branch: [],
                match: this.visit(ctx.matchBlock[0])
            }
        }

        // Normal case: statements optionally followed by a block
        const branch = (ctx.statement ?? []).map((s: any) => this.visit(s));

        return { text, branch };
    }

    skipBlock(ctx: any): SkipBlockTree {
        return {
            kind: 'skipBlock',
            label: ctx.Text[0].image.trim(),
            body: (ctx.statement ?? []).map((s: any) => this.visit(s)),
        };
    }

    matchBlock(ctx: any): MatchTree {
        return {
            on: ctx.Text[0].image.trim(),
            branches: (ctx.matchBranch ?? []).map((b: any) => this.visit(b)),
            chained: ctx.matchBlock ? this.visit(ctx.matchBlock[0]) : undefined
        };
    }

    matchBranch(ctx: any): MatchBranch {
        return {
            value: ctx.Text[0].image.trim(),
            body: (ctx.statement ?? []).map((s: any) => this.visit(s)),
            match: ctx.matchBlock ? this.visit(ctx.matchBlock[0]) : undefined
        };
    }

}