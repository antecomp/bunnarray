import type { Program } from './compiler/instructions';
import createVM from './interpreter/vm';

type Step = ReturnType<ReturnType<typeof createVM>['init']>;

/** Append each VM yield to the dialogue stack as it is reached. */
export default function runDialogue(program: Program, stack: HTMLDivElement): void {
    const vm = createVM(program);

    vm.signals.subscribe(({ identifier, value }) => {
        const entry = document.createElement('div');
        entry.className = 'dialogue-entry';

        const text = document.createElement('p');
        text.className = 'dialogue-text';
        text.textContent = `Signal emitted: ${identifier}${value === undefined ? '' : `: ${value}`}`;
        entry.append(text);

        stack.append(entry);
    });

    function render(step: Step): void {
        if (step.kind === 'end' && step.presentation === null) return;

        const entry = document.createElement('div');
        entry.className = 'dialogue-entry';

        if (step.presentation !== null) {
            const text = document.createElement('p');
            text.className = 'dialogue-text';
            text.textContent = (step.presentation.speaker ?? '(NARRATOR)') + ': ' + step.presentation.text;
            entry.append(text);
        }

        if (step.kind === 'yield') {
            const text = document.createElement('p');
            text.className = 'dialogue-text';
            text.textContent = `Yield emitted: ${step.identifier}${step.value === undefined ? '' : `: ${step.value}`}`;
            entry.append(text);
        }

        const actions = document.createElement('div');
        actions.className = 'dialogue-actions';

        if (step.kind === 'say' || step.kind === 'yield') {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Continue';
            button.addEventListener('click', () => {
                const next = step.resume();
                button.classList.add('is-selected');
                render(next);
            });
            actions.append(button);
        } else if (step.kind === 'choice') {
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

        if (step.kind !== 'end') entry.append(actions);
        stack.append(entry);
    }

    render(vm.init());
}
