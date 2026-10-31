import { createVM, type Emission, type Program, type Wait } from '@bunnarray/vm';

/** Append VM emissions and offer the action required by each pause. */
export default function runDialogue(program: Program, stack: HTMLDivElement): void {
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

    function handleEmission(emission: Emission): void {
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
            case 'end':
                break;
        }
    }

    const vm = createVM(program, { handler: handleEmission });

    function advance(run: () => Wait): void {
        actionEntry = null;
        const wait = run();
        if (wait.kind === 'end') return;

        const actions = document.createElement('div');
        actions.className = 'dialogue-actions';
        const buttons: HTMLButtonElement[] = [];
        let consumed = false;

        function addButton(label: string, resume: () => Wait): void {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', () => {
                if (consumed) return;
                consumed = true;
                buttons.forEach(action => { action.disabled = true; });
                button.classList.add('is-selected');
                advance(resume);
            });
            buttons.push(button);
            actions.append(button);
        }

        switch (wait.kind) {
            case 'select':
                wait.options.forEach((option, index) => addButton(option.text, () => vm.choose(index)));
                break;
            case 'next':
                addButton('Continue', () => vm.next());
                break;
            case 'yield':
                actionEntry = appendEntry(`Yield: ${wait.identifier}${wait.value === undefined ? '' : `: ${wait.value}`}`);
                addButton('Continue', () => vm.resume());
                break;
        }

        (actionEntry ?? appendEntry()).append(actions);
    }

    advance(() => vm.start());
}
