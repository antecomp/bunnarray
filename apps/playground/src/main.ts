import stock from '../../../examples/man.bny?raw';
import { buildDebug } from './buildDebug';
import formatIR from './visualize/formatIR';
import runDialogue from './runner';

const compileButton = document.getElementById('compile-button') as HTMLButtonElement;
const demoTextarea = document.getElementById('demo-textarea') as HTMLTextAreaElement;
const debugDiv = document.getElementById('debug') as HTMLPreElement;
const IRVis = document.getElementById('IR') as HTMLPreElement;
const dialogueStack = document.getElementById('dialogue-stack') as HTMLDivElement;

function display(x: any) {
    console.log(x);
    debugDiv.innerHTML = JSON.stringify(x, null, 2);
}

demoTextarea.value = stock;
compileButton.onclick = () => {
    dialogueStack.replaceChildren();
    const rez = buildDebug(demoTextarea.value);
    display(
        rez
    );
    if (rez) {
        IRVis.innerText = formatIR(rez.ir);
        runDialogue(rez.ir, dialogueStack);
    }
};
