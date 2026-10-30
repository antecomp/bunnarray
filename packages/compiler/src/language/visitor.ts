import type * as AST from './ast';
import type * as CST from './cst';

import parser from './parser';
const BaseVisitor = parser.getBaseCstVisitorConstructor();

const escapedCharacters: Record<string, string> = {
    lbrack: '[',
    rbrack: ']',
    lbrace: '{',
    rbrace: '}',
    hash: '#',
    pipe: '|',
    amp: '&'
};

function decodeText(text: string): string {
    return text.replace(/&(lbrack|rbrack|lbrace|rbrace|hash|pipe|amp);/g,
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


class DialogueVisitor extends BaseVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    dialogue(ctx: CST.DialogueCstChildren): AST.DialogueAST {
        return {
            type: 'dialogue',
            statements: (ctx.statement ?? []).map(s => this.visit(s))
        };
    }

    statement(ctx: CST.StatementCstChildren): AST.Statement {
        const node =
            ctx.say?.[0] ?? ctx.choice?.[0] ??
            ctx.skip?.[0] ?? ctx.label?.[0] ?? ctx.goto?.[0] ??
            ctx.set?.[0] ?? ctx.speaker?.[0] ?? ctx.shorthandSpeaker?.[0] ?? ctx.alternate?.[0] ??
            ctx.signal?.[0] ?? ctx.branch?.[0] ?? ctx.yield?.[0]
            ;

        if (!node) throw new Error('Statement has no matching CST node');

        return this.visit(node);
    }

    say(ctx: CST.SayCstChildren): AST.SayStatement {
        return {
            type: 'say',
            text: decodeText(ctx.Text[0].image.trim())
        };
    }

    choice(ctx: CST.ChoiceCstChildren): AST.ChoiceStatement {
        return {
            type: 'choice',
            branches: (ctx.choiceBranch ?? []).map(branch => this.visit(branch))
        };
    }

    choiceBranch(ctx: CST.ChoiceBranchCstChildren): AST.ChoiceBranch {
        return {
            type: 'choiceBranch',
            text: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map(s => this.visit(s)),
            condition: ctx.when && this.visit(ctx.when),
            id: ctx.id && this.visit(ctx.id)
        };
    }

    id(ctx: CST.IdCstChildren) { return decodeText(ctx.Text[0].image.trim()); }

    branch(ctx: CST.BranchCstChildren): AST.BranchStatement {
        return {
            type: 'branch',
            cases: (ctx.branchCase ?? []).map(bcase => this.visit(bcase))
        };
    }

    branchCase(ctx: CST.BranchCaseCstChildren): AST.BranchCase {
        return {
            type: 'branchCase',
            condition: this.visit(ctx.when),
            statements: (ctx.statement ?? []).map(s => this.visit(s))
        };
    }

    when(ctx: CST.WhenCstChildren): AST.Condition {
        return {
            type: 'equals',
            identifier: (ctx.Identifier[0].image.trim()),
            value: decodeText(ctx.Text[0].image.trim())
        };
    }

    skip(ctx: CST.SkipCstChildren): AST.SkipStatement {
        return {
            type: 'skip',
            label: decodeText(ctx.Text[0].image.trim()),
            statements: (ctx.statement ?? []).map(s => this.visit(s))
        };
    }

    set(ctx: CST.SetCstChildren): AST.SetStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'set',
            identifier: (ctx.Identifier[0].image.trim()),
            value: value === undefined ? null : decodeText(value.trim())
        };
    }

    signal(ctx: CST.SignalCstChildren): AST.SignalStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'signal',
            identifier: (ctx.Identifier[0].image.trim()),
            ...(value === undefined ? {} : { value: decodeText(value.trim()) })
        };
    }

    yield(ctx: CST.YieldCstChildren): AST.YieldStatement {
        const value: string | undefined = ctx.Text?.[0]?.image;
        return {
            type: 'yield',
            identifier: (ctx.Identifier[0].image.trim()),
            ...(value === undefined ? {} : { value: decodeText(value.trim()) })
        };
    }

    label(ctx: CST.LabelCstChildren): AST.LabelStatement {
        return {
            type: 'label',
            name: decodeText(ctx.Text[0].image.trim())
        };
    }

    goto(ctx: CST.GotoCstChildren): AST.GotoStatement {
        return {
            type: 'goto',
            target: decodeText(ctx.Text[0].image.trim())
        };
    }

    speaker(ctx: CST.SpeakerCstChildren): AST.SpeakerStatement {
        const im = ctx.Text?.[0]?.image;
        return {
            type: 'speaker',
            value: im ? decodeText(im.trim()) : null
        };
    }

    shorthandSpeaker(ctx: CST.ShorthandSpeakerCstChildren): AST.SpeakerStatement {
        const im = ctx.Text?.[0]?.image;
        return {
            type: 'speaker',
            value: im ? decodeText(im.trim()) : null
        };
    }

    alternate(ctx: CST.AlternateCstChildren): AST.AlternateStatement {
        const text: string | undefined = ctx.Text?.[0]?.image;
        const speakers = text === undefined
            ? []
            : splitSpeakerNames(text).map(name => name === '' ? null : name);

        return { type: 'alternate', speakers };
    }
}

const visitor = new DialogueVisitor();
export default visitor;