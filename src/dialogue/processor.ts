// Immediate Representation - Takes simplified tree from Visitor and flattens it into plain set of UnlinkedNodes.
// UnlinkedNodes track connections with IDs, that will then be converted into proper DialogueNodes and linked later.

import { generateId } from "./genid";
import { GotoTree, NodeTree, OptionTree, TextTree } from "./visitor";


export default function flatten() {
    throw new Error("Requires rewrite.");
}