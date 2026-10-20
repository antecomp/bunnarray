import type { Data, Edge, Node } from 'vis-network/standalone';
import type {
    ChoiceBranch,
    DialogueAST,
    MatchBranch,
    Statement,
} from '../language/ast';

type AstNode = DialogueAST | Statement | ChoiceBranch | MatchBranch;

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
            case 'match':
                nodes.push({ id, label: `match: ${node.on}` });
                break;
            case 'matchBranch':
                nodes.push({ id, label: `case: ${node.case}` });
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
        }

        if (parentId !== undefined) {
            edges.push({ from: parentId, to: id });
        }

        switch (node.type) {
            case 'dialogue':
            case 'choiceBranch':
            case 'matchBranch':
            case 'skip':
                node.statements.forEach(child => addNode(child, id));
                break;
            case 'choice':
                node.branches.forEach(child => addNode(child, id));
                break;
            case 'match':
                node.branches.forEach(child => addNode(child, id));
                break;
        }
    }

    addNode(ast);
    return { nodes, edges };
}
