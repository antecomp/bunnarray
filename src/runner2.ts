import type { Program } from './compiler/instructions';
import createVM, { type Emission, type Wait } from './interpreter/vm2';

/** Append VM emissions and offer the action required by each pause. */
export default function runDialogue(program: Program, stack: HTMLDivElement): void {
    let actionEntry: HTMLDivElement | null = null;
    let options: string[] = [];

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
            case 'signal':
            case 'yield': {
                const label = emission.kind === 'signal' ? 'Signal' : 'Yield';
                const entry = appendEntry(`${label} emitted: ${emission.identifier}${emission.value === undefined ? '' : `: ${emission.value}`}`);
                if (emission.kind === 'yield') actionEntry = entry;
                break;
            }
            case 'options':
                options = emission.options;
                actionEntry ??= appendEntry();
                break;
            case 'end':
                break;
        }
    }

    const vm = createVM(program, { handler: handleEmission });

    function advance(run: () => Wait): void {
        actionEntry = null;
        options = [];
        const wait = run();
        if (wait === 'end') return;

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

        if (wait === 'select') {
            options.forEach((option, index) => addButton(option, () => vm.choose(index)));
        } else {
            addButton('Continue', wait === 'next' ? () => vm.next() : () => vm.resume());
        }

        (actionEntry ?? appendEntry()).append(actions);
    }

    advance(() => vm.start());
}
