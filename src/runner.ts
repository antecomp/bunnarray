import type { Program } from './compiler/instructions';
import createVM from './interpreter/vm';

type Step = ReturnType<ReturnType<typeof createVM>['init']>;

/** Append each VM yield to the dialogue stack as it is reached. */
export default function runDialogue(program: Program, stack: HTMLDivElement): void {
    const vm = createVM(program);

    function render(step: Step): void {
        if (step.kind === 'end') return;

        const entry = document.createElement('div');
        entry.className = 'dialogue-entry';

        if (step.text !== null) {
            const text = document.createElement('p');
            text.className = 'dialogue-text';
            text.textContent = step.text;
            entry.append(text);
        }

        const actions = document.createElement('div');
        actions.className = 'dialogue-actions';

        if (step.kind === 'say') {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Continue';
            button.addEventListener('click', () => {
                const next = step.resume();
                button.classList.add('is-selected');
                render(next);
            });
            actions.append(button);
        } else {
            step.choices.forEach((choice, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = choice;
                button.addEventListener('click', () => {
                    const next = step.resume(index);
                    button.classList.add('is-selected');
                    render(next);
                });
                actions.append(button);
            });
        }

        entry.append(actions);
        stack.append(entry);
    }

    render(vm.init());
}
