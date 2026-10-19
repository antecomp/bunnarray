import { DialogueLexer } from "../language/lexer";
import preprocess from "../language/preprocess";


export default function(raw: string) {
    console.log("𑣲₍ ᐢ. .ᐢ₎ : Compiling .bny dialogue...");

    const normalized = preprocess(raw);
    const lex = DialogueLexer.tokenize(normalized);
    
    if (lex.errors.length > 0) {
        console.error("Lex errors:", lex.errors);
        return null;
    }

    return JSON.stringify(lex, null, 2);
}