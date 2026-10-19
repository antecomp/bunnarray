import { Network } from 'vis-network/standalone';
import stock from '../examples/test.bny?raw';
import compile from './compiler/compile';
import { astToNetworkData } from './visualize/astToNetworkData';

const compileButton = document.getElementById('compile-button') as HTMLButtonElement;
const demoTextarea = document.getElementById('demo-textarea') as HTMLTextAreaElement;
const debugDiv = document.getElementById('debug') as HTMLPreElement;
let astNetwork: Network | undefined;

function display(x: any) {
    console.log(x);
    debugDiv.innerHTML = JSON.stringify(x, null, 2);
}

demoTextarea.value = stock;
compileButton.onclick = () => {
    const rez = compile(demoTextarea.value);
    astNetwork?.destroy();
    astNetwork = rez
        ? new Network(
            document.getElementById('ast-graph')!,
            astToNetworkData(rez.ast),
            {
                nodes: {
                    shape: 'box',
                    widthConstraint: 180,
                    margin: { top: 12, right: 12, bottom: 12, left: 12 },
                },
                edges: { smooth: false },
                layout: {
                    hierarchical: {
                        enabled: true,
                        direction: 'UD',
                        sortMethod: 'directed',
                        levelSeparation: 160,
                        nodeSpacing: 220,
                    },
                },
                physics: { enabled: false },
            }
        )
        : undefined;
    display(
        rez
    );
}
