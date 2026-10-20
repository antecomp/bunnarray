import { DialogueAST } from "../language/ast";
import { DialogueLexer } from "../language/lexer";
import { DialogueParser } from "../language/parser";
import preprocess from "../language/preprocess";
import { DialogueVisitor } from "../language/vistor";
import lower from "./lower";

const parser = new DialogueParser();
const visitor = new DialogueVisitor();

export default function(raw: string) {
    console.log("𑣲₍ ᐢ. .ᐢ₎ : Compiling .bny dialogue...");

    const normalized = preprocess(raw);
    const lex = DialogueLexer.tokenize(normalized);
    
    if (lex.errors.length > 0) {
        console.error("Lex errors:", lex.errors);
        return null;
    }

    parser.input = lex.tokens;
    const cst = parser.dialogue();
    if (parser.errors.length > 0) {
        console.error("Parse errors:", parser.errors);
        return null;
    }

    const ast = visitor.visit(cst) as DialogueAST;

    const ir = lower(ast);

    return {
        ir,
        ast,
        cst,
        lex
    };
}