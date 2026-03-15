import { DialogueParser } from "./parser";
import { DialogueVisitor } from "./visitor";
import { resetIdCounter } from "./genid";
import { DialogueLexer } from "./lexer";

const parser = new DialogueParser();
const visitor = new DialogueVisitor();

function testVisitor(input: string) {
    resetIdCounter();

    const lexResult = DialogueLexer.tokenize(input);
    parser.input = lexResult.tokens;
    const cst = parser.dialogue();

    if (parser.errors.length > 0) {
        console.error("Parse errors:", parser.errors);
        return;
    }

    const tree = visitor.visit(cst);
    console.log(JSON.stringify(tree, null, 2));
}



export default function test() {
testVisitor(`
@start
Hello, friend.
How are you? {
    ?: Doing well!
        @nestedlabel
        That is great to hear.
    ?: Doing bad.
        Sorry to hear that.
        -> elsewhere
}
Fallback here.
@elsewhere
We jumped here.
`);
}