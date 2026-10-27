import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Instruction } from '@bunnarray/vm';
import runDialogue from '../runner';

/** The runner only needs element creation, appending, and click listeners. */
class Element {
    children: Element[] = [];
    className = '';
    textContent = '';
    type = '';
    disabled = false;
    classes = new Set<string>();
    classList = { add: (name: string) => { this.classes.add(name); } };
    private onClick = () => {};

    constructor(readonly tagName: string) {}

    append(child: Element): void { this.children.push(child); }
    addEventListener(_event: string, listener: () => void): void { this.onClick = listener; }
    // Dispatch even on disabled buttons to check stale listeners are also guarded.
    click(): void { this.onClick(); }

    find(tagName: string): Element[] {
        return this.children.flatMap(child => [
            ...(child.tagName === tagName ? [child] : []),
            ...child.find(tagName)
        ]);
    }
}

describe('runner with vm', () => {
    let stack: Element;

    beforeEach(() => {
        stack = new Element('div');
        vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
    });

    afterEach(() => { vi.unstubAllGlobals(); });

    function run(instructions: Instruction[]): void {
        runDialogue({ version: { major: 1, minor: 0 }, instructions }, stack as unknown as HTMLDivElement);
    }

    function lines(): string[] { return stack.find('p').map(element => element.textContent); }

    it('advances consecutive lines once and leaves no action on the final line', () => {
        run([
            { op: 'SPEAKER', value: 'Alice' },
            { op: 'SAY', text: 'Hello' },
            { op: 'SAY', text: 'Goodbye' },
            { op: 'END' }
        ]);
        expect(lines()).toEqual(['Alice: Hello']);
        const button = stack.find('button')[0];
        button.click();
        expect(lines()).toEqual(['Alice: Hello', 'Alice: Goodbye']);
        expect(button.disabled).toBe(true);
        expect(button.classes.has('is-selected')).toBe(true);
        button.click();
        expect(lines()).toHaveLength(2);
        expect(stack.find('button')).toHaveLength(1);
    });

    it('renders signals in order without attaching continuation to the signal', () => {
        run([
            { op: 'SAY', text: 'First' },
            { op: 'SIGNAL', identifier: 'event', value: '' },
            { op: 'SAY', text: 'Last' },
            { op: 'END' }
        ]);
        expect(lines()).toEqual(['(NARRATOR): First', 'Signal emitted: event: ']);
        expect(stack.children[0].find('button')).toHaveLength(1);
        expect(stack.children[1].find('button')).toHaveLength(0);
        stack.find('button')[0].click();
        expect(lines()[2]).toBe('(NARRATOR): Last');
    });

    it('resumes consecutive yields and handles the next pause without a new emission', () => {
        run([
            { op: 'SAY', text: 'Before' },
            { op: 'YIELD', identifier: 'first', value: undefined },
            { op: 'YIELD', identifier: 'second', value: 'payload' },
            { op: 'SAY', text: 'After' },
            { op: 'END' }
        ]);
        expect(lines()).toEqual(['(NARRATOR): Before', 'Yield emitted: first']);
        stack.find('button')[0].click();
        expect(lines()[2]).toBe('Yield emitted: second: payload');
        stack.find('button')[1].click();
        expect(lines()).toHaveLength(3);
        stack.find('button')[2].click();
        expect(lines()[3]).toBe('(NARRATOR): After');
    });

    it('chooses the visible option index and disables every previous option', () => {
        run([
            { op: 'CHOICE', choices: [
                { text: 'Hidden', target: 1, condition: { identifier: 'hidden', value: 'yes' } },
                { text: 'Left', target: 1 },
                { text: 'Right', id: 'right', target: 3 }
            ], fallback: 5 },
            { op: 'SAY', text: 'Left branch' },
            { op: 'END' },
            { op: 'SAY', text: 'Right branch' },
            { op: 'END' },
            { op: 'END' }
        ]);
        const buttons = stack.find('button');
        expect(buttons.map(button => button.textContent)).toEqual(['Left', 'Right']);
        buttons[1].click();
        expect(lines()).toEqual(['(NARRATOR): Right branch']);
        expect(buttons.every(button => button.disabled)).toBe(true);
        buttons[0].click();
        expect(lines()).toEqual(['(NARRATOR): Right branch']);
    });

    it('does not add an empty entry for an empty program', () => {
        run([{ op: 'END' }]);
        expect(stack.children).toEqual([]);
    });
});
