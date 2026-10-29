import type * as A from './ast';

import { DialogueParser } from './parser';
const parser = new DialogueParser();
const BaseVisitor = parser.getBaseCstVisitorConstructor();

const escapedCharacters: Record<string, string> = {
    lbrack: '[',
    rbrack: ']',
    lbrace: '{',
    rbrace: '}',
    hash: '#',
    amp: '&'
};

function decodeText(text: string): string {
    return text.replace(/&(lbrack|rbrack|lbrace|rbrace|hash|amp);/g,
        (_, name: string) => escapedCharacters[name]);
}

function splitSpeakerNames(text: string): string[] {
    const names: string[] = [];
    let start = 0;

    // Escape sequences also end in semicolons, including literal ones like &amp;lbrace;.
    for (const match of text.matchAll(/&(?:amp;)?[A-Za-z][A-Za-z0-9]*;|;/g)) {
        if (match[0] !== ';') continue;
        names.push(decodeText(text.slice(start, match.index).trim()));
        start = match.index + 1;
    }

    names.push(decodeText(text.slice(start).trim()));
    return names;
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
            ctx.say?.[0] ?? ctx.choice?.[0] ??
            ctx.skip?.[0] ?? ctx.label?.[0] ?? ctx.goto?.[0] ??
            ctx.set?.[0] ?? ctx.speaker?.[0] ?? ctx.alternate?.[0] ??
            ctx.signal?.[0] ?? ctx.branch?.[0] ?? ctx.yield?.[0]
            ;

        return this.visit(node);
    }

    say(ctx: any): A.SayStatement {
        return {
            type: 'say',
            text: decodeText(ctx.Text[0].image.trim())
        };
    }

    choice(ctx: any): A.ChoiceStatement {
        return {
            type: 'choice',
            branches: (ctx.choiceBranch ?? []).map((branch: any) => this.visit(branch))
        };
    }

    choiceBranch(ctx: any): A.ChoiceBranch {
        return {
            type: 'choiceBranch',
            text: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s)),
            condition: ctx.when && this.visit(ctx.when),
            id: ctx.id && this.visit(ctx.id)
        };
    }

    id(ctx: any) { return decodeText(ctx.Text[0].image.trim()); }

    branch(ctx: any): A.BranchStatement {
        return {
            type: 'branch',
            cases: (ctx.branchCase ?? []).map((bcase: any) => this.visit(bcase))
        };
    }

    branchCase(ctx: any): A.BranchCase {
        return {
            type: 'branchCase',
            condition: this.visit(ctx.when),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        };
    }

    when(ctx: any): A.Condition {
        return {
            type: 'equals',
            identifier: (ctx.Identifier[0].image.trim()),
            value: decodeText(ctx.Text[0].image.trim())
        };
    }

    skip(ctx: any): A.SkipStatement {
        return {
            type: 'skip',
            label: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map((s: any) => this.visit(s))
        };
    }

    set(ctx: any): A.SetStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'set',
            identifier: (ctx.Identifier[0].image.trim()),
            value: value === undefined ? null : decodeText(value.trim())
        };
    }

    signal(ctx: any): A.SignalStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'signal',
            identifier: (ctx.Identifier[0].image.trim()),
            ...(value === undefined ? {} : { value: decodeText(value.trim()) })
        };
    }

    yield(ctx: any): A.YieldStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'yield',
            identifier: (ctx.Identifier[0].image.trim()),
            ...(value === undefined ? {} : { value: decodeText(value.trim()) })
        };
    }

    label(ctx: any): A.LabelStatement {
        return {
            type: 'label',
            name: decodeText(ctx.Text[0].image.trim())
        };
    }

    goto(ctx: any): A.GotoStatement {
        return {
            type: 'goto',
            target: decodeText(ctx.Text[0].image.trim())
        };
    }

    speaker(ctx: any): A.SpeakerStatement {
        const im = ctx.Text?.[0]?.image;
        return {
            type: 'speaker',
            value: im ? decodeText(im.trim()) : null
        };
    }

    alternate(ctx: any): A.AlternateStatement {
        const text: string | undefined = ctx.Text?.[0]?.image;
        const speakers = text === undefined
            ? []
            : splitSpeakerNames(text).map(name => name === '' ? null : name);

        return { type: 'alternate', speakers };
    }
}

