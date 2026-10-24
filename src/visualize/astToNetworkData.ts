import type { Data, Edge, Node } from 'vis-network/standalone';
import type {
    ChoiceBranch,
    BranchCase,
    DialogueAST,
    Statement
} from '../language/ast';

type AstNode = DialogueAST | Statement | ChoiceBranch | BranchCase;

/** Convert a dialogue AST into the nodes and edges accepted by vis-network. */
export function astToNetworkData(ast: DialogueAST): Data {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    function addNode(node: AstNode, parentId?: number): void {
        const id = nodes.length;

        switch (node.type) {
            case 'dialogue':
            case 'choice':
                nodes.push({ id, label: node.type });
                break;
            case 'say':
            case 'choiceBranch':
                nodes.push({ id, label: `${node.type}: ${node.text}` });
                break;
            case 'branch':
                nodes.push({ id, label: 'branch' });
                break;
            case 'branchCase':
                nodes.push({ id, label: `when: ${node.condition.identifier} = ${JSON.stringify(node.condition.value)}` });
                break;
            case 'skip':
                nodes.push({ id, label: `skip: ${node.label}` });
                break;
            case 'label':
                nodes.push({ id, label: `label: ${node.name}` });
                break;
            case 'goto':
                nodes.push({ id, label: `goto: ${node.target}` });
                break;
            case 'signal':
                nodes.push({
                    id,
                    label: `signal: ${node.identifier}${node.value === undefined ? '' : ` = ${JSON.stringify(node.value)}`}`
                });
                break;
            case 'set':
                nodes.push({
                    id,
                    label: `set: ${node.identifier}${node.value === undefined ? '' : ` = ${JSON.stringify(node.value)}`}`
                });
                break;
            // TODO alternate & speaker
        }

        if (parentId !== undefined) {
            edges.push({ from: parentId, to: id });
        }

        switch (node.type) {
            case 'dialogue':
            case 'choiceBranch':
            case 'branchCase':
            case 'skip':
                node.statements.forEach(child => addNode(child, id));
                break;
            case 'choice':
                node.branches.forEach(child => addNode(child, id));
                break;
            case 'branch':
                node.cases.forEach(child => addNode(child, id));
                break;
        }
    }

    addNode(ast);
    return { nodes, edges };
}
