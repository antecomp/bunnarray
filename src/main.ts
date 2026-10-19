import stock from '../examples/test.bny?raw';
import preprocess from './language/preprocess';

const compileButton = document.getElementById('compile-button') as HTMLButtonElement;
const demoTextarea = document.getElementById('demo-textarea') as HTMLTextAreaElement;
const debugDiv = document.getElementById('debug') as HTMLPreElement;

function display(x: any) {
    console.log(x);
    debugDiv.innerHTML = x;
}

demoTextarea.value = stock;
compileButton.onclick = () => {
    display(preprocess(demoTextarea.value))
}