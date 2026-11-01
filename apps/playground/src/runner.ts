import { createVM, type BnyEmission, type BnyProgram, type BnyPause } from '@bunnarray/vm';

/** Append VM emissions and offer the action required by each pause. */
export default function runDialogue(program: BnyProgram, stack: HTMLDivElement): void {
    let actionEntry: HTMLDivElement | null = null;
    function appendEntry(text?: string): HTMLDivElement {
        const entry = document.createElement('div');
        entry.className = 'dialogue-entry';
        if (text !== undefined) {
            const paragraph = document.createElement('p');
            paragraph.className = 'dialogue-text';
            paragraph.textContent = text;
            entry.append(paragraph);
        }
        stack.append(entry);
        return entry;
    }

    function handleEmission(emission: BnyEmission): void {
        switch (emission.kind) {
            case 'say':
                actionEntry = appendEntry(`${emission.speaker ?? '(NARRATOR)'}: ${emission.text}`);
                break;
            case 'memory':
                appendEntry(`Memory changed: ${emission.key}: ${JSON.stringify(emission.prev) ?? '(unset)'} → ${JSON.stringify(emission.value) ?? '(unset)'}`);
                break;
            case 'signal': {
                appendEntry(`Signal emitted: ${emission.identifier}${emission.value === undefined ? '' : `: ${emission.value}`}`);
                break;
            }
        }
    }

    function handlePause(pause: BnyPause): void {
        if (pause.kind === 'end') return;

        const actions = document.createElement('div');
        actions.className = 'dialogue-actions';
        const buttons: HTMLButtonElement[] = [];
        let consumed = false;

        function addButton(label: string, resume: () => void): void {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => {
                if (consumed) return;
                consumed = true;
                buttons.forEach(action => { action.disabled = true; });
                button.classList.add('is-selected');
                actionEntry = null;
                resume();
            });
            buttons.push(button);
            actions.append(button);
        }

        switch (pause.kind) {
            case 'select':
                pause.options.forEach((option, index) => addButton(option.text, () => pause.resume(index)));
                break;
            case 'next':
                addButton('Continue', pause.resume);
                break;
            case 'yield':
                actionEntry = appendEntry(`Yield: ${pause.identifier}${pause.value === undefined ? '' : `: ${pause.value}`}`);
                addButton('Continue', pause.resume);
                break;
        }

        (actionEntry ?? appendEntry()).append(actions);
    }

    const vm = createVM(program, { onEmission: handleEmission, onPause: handlePause });
    vm.start();
}
