import { createLabelMap, firstNodeOf, linkNodes } from "./linker";
import { LinkedNode, parseSequence } from "./parser";
import tokenize from "./tokenizer";

export default function compileDialogue(raw: string): LinkedNode | null {
    const tokens = tokenize(raw);
    console.log('tokens', tokens);

    const {nodes, labels} = parseSequence(tokens, 0);
    console.log('nodes', nodes);
    console.log('labels', labels);

    const labelMap = createLabelMap(labels);
    console.log('labelMap', labelMap);

    linkNodes(nodes, null, labelMap);
    console.log('nodes, linked', nodes);
    
    return firstNodeOf(nodes); // Do another run to get face data later.
}

export function traceCompiledDialogue(node: LinkedNode | null, visited = new Set<LinkedNode>()): void {
  if (!node || visited.has(node)) return;
  visited.add(node);
  console.log('TEXT:', node.text);
  if ('options' in node) {
    for (const opt of node.options) {
      console.log('  OPTION:', opt.text);
      traceCompiledDialogue(opt.next, visited);
    }
  } else {
    traceCompiledDialogue(node.next, visited);
  }
}