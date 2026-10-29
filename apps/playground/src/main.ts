import stock from '../../../examples/man.bny?raw';
import { buildDebug } from './buildDebug';
import formatIR from './visualize/formatIR';
import runDialogue from './runner';

const compileButton = document.getElementById('compile-button') as HTMLButtonElement;
const demoTextarea = document.getElementById('demo-textarea') as HTMLTextAreaElement;
const IRVis = document.getElementById('IR') as HTMLPreElement;
const dialogueStack = document.getElementById('dialogue-stack') as HTMLDivElement;

demoTextarea.value = stock;
compileButton.onclick = () => {
    dialogueStack.replaceChildren();
    const rez = buildDebug(demoTextarea.value);
    if (rez) {
        console.log(rez);
        IRVis.innerText = formatIR(rez.ir);
        runDialogue(rez.ir, dialogueStack);
    }
};
