import stock from '../../../examples/man.bny?raw';
import { buildDebug } from './buildDebug';
import formatIR from './visualize/formatIR';
import runDialogue from './runner';
import { CodeJar } from 'codejar';
import { highlightBNY } from './highlightBNY';
import { trackEditorLines } from './editorLines';

const compileButton = document.getElementById('compile-button') as HTMLButtonElement;
const editor = document.getElementById('source-editor') as HTMLDivElement;
const IRVis = document.getElementById('IR') as HTMLPreElement;
const dialogueStack = document.getElementById('dialogue-stack') as HTMLDivElement;

const jar = CodeJar(editor, element => {
    element.innerHTML = highlightBNY(element.textContent ?? '');
}, {
    tab: '    ',
    // Bracket tags are complete on one line; only choice braces open a new indent.
    indentOn: /\{\s*(?:#.*)?$/,
    moveToNewLine: /^\s*\}/,
    autoclose: { open: '{[', close: '}]' },
    spellcheck: true
});
jar.updateCode(stock);
const stopTrackingLines = trackEditorLines(editor);
editor.addEventListener('keydown', event => {
    if (event.key === 'Escape') compileButton.focus();
});
if (import.meta.hot) import.meta.hot.dispose(() => {
    stopTrackingLines();
    jar.destroy();
});

compileButton.onclick = () => {
    dialogueStack.replaceChildren();
    const rez = buildDebug(jar.toString());
    if (rez) {
        console.log(rez);
        IRVis.innerText = formatIR(rez.ir);
        runDialogue(rez.ir, dialogueStack);
    }
};
