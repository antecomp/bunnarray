import { describe, it, expect, beforeEach } from 'vitest';
import { compileBnyDialogue } from '../dialogue/compilebny';
import { DialogueNode, DialogueMatch } from '../dialogue/types';

// ---- Helpers ----

// Follow next pointers collecting text
function trace(node: DialogueNode | null | undefined, visited = new Set<DialogueNode>()): string[] {
    if (!node || visited.has(node)) return [];
    visited.add(node);
    const texts = [node.text];
    if ('next' in node && node.next) texts.push(...trace(node.next, visited));
    return texts;
}

// Get option texts from a node
function optionTexts(node: DialogueNode): string[] {
    if (!('options' in node)) return [];
    return node.options.map(o => o.text);
}

// Choose an option by text, returns the next node
function choose(node: DialogueNode, optionText: string): DialogueNode {
    if (!('options' in node)) throw new Error('Node has no options');
    const opt = node.options.find(o => o.text === optionText);
    if (!opt) throw new Error(`Option "${optionText}" not found`);
    if ('match' in opt) throw new Error('Option leads to match, use navigateMatch');
    return opt.next;
}

// Navigate a match with a given result
function navigateMatch(node: DialogueNode, result: string): DialogueNode | DialogueMatch {
    if (!('match' in node)) throw new Error('Node has no match');
    const match = node.match;
    const branch = match.matches[result] ?? match.fallback;
    if (!branch) throw new Error(`No branch for result "${result}" and no fallback`);
    return branch as DialogueNode;
}

function compile(raw: string): DialogueNode {
    const result = compileBnyDialogue(raw, false);
    if (!result) throw new Error('Compilation failed');
    return result;
}

describe('Basic sequencing', () => {
    it('Single text node', () => {
        const root = compile('Hello');
        expect(root.text).toBe('Hello');
        expect('next' in root && root.next).toBeNull();
    });

    it('multiple text nodes chain correctly', () => {
        const root = compile(`
            Hello
            How are you?
            Goodbye    
        `);
        expect(trace(root)).toEqual(['Hello', 'How are you?', 'Goodbye']);
    });

    it('label is registered on text node', () => {
        const root = compile(`
            @start
            Hello
            Goodbye
        `);
        expect(root.text).toBe('Hello');
        expect(trace(root)).toEqual(['Hello', 'Goodbye']);
    });

    it('goto redirects next pointer', () => {
        const root = compile(`
            Hello
            -> end
            Middle (should be skipped)
            @end
            Goodbye
        `);
        expect(root.text).toBe('Hello');
        if (!('next' in root)) throw new Error();
        expect(root.next?.text).toBe('Goodbye');
    });

    it('goto as last item points to label', () => {
        const root = compile(`
            @start
            Hello
            -> start
        `);
        expect(root.text).toBe('Hello');
        if (!('next' in root)) throw new Error();
        expect(root.next).toBe(root); // circular reference back to start
    });

    it('forward reference goto resolves correctly', () => {
        const root = compile(`
            Hello
            -> end
            @end
            Goodbye
        `);
        if ('next' in root) {
            //@ts-expect-error - fuck off
            expect(root.next.text).toBe('Goodbye');
        } else {
            throw new Error("Root has no next!")
        }
    });
});

describe('option blocks', () => {
    it('basic options with fallback', () => {
        const root = compile(`
            How are you? {
                ?: Good
                    Great!
                ?: Bad
                    Sorry!
            }
            Fallback
        `);
        //console.log(root)
        expect(optionTexts(root)).toEqual(['Good', 'Bad']);
        const good = choose(root, 'Good');
        expect(good.text).toBe('Great!');
        expect(trace(good)).toEqual(['Great!', 'Fallback']);
        const bad = choose(root, 'Bad');
        expect(trace(bad)).toEqual(['Sorry!', 'Fallback']);
    });

    it('option with goto wins over fallback', () => {
        const root = compile(`
            Prompt {
                ?: Jump
                    -> end
                ?: Stay
                    Here
            }
            Fallback
            @end
            End
        `);
        const jump = choose(root, 'Jump');
        expect(jump.text).toBe('End');
        const stay = choose(root, 'Stay');
        expect(trace(stay)).toEqual(['Here', 'Fallback', 'End']);
    });

    it('empty option branch uses fallback', () => {
        const root = compile(`
            Prompt {
                ?: Empty
            }
            Fallback
        `);
        const empty = choose(root, 'Empty');
        expect(empty.text).toBe('Fallback');
    });

    it('chained option inherits parent prompt', () => {
        const root = compile(`
            Prompt {
                ?: Chain {
                    ?: Inner A
                        A result
                    ?: Inner B
                        B result
                }
            }
            Fallback
        `);
        const chain = choose(root, 'Chain');
        expect(chain.text).toBe('Prompt'); // synthetic node reuses parent prompt
        expect(optionTexts(chain)).toEqual(['Inner A', 'Inner B']);
    });

    it('nested option block threads fallback correctly', () => {
        const root = compile(`
            Outer {
                ?: Enter
                    Inner {
                        ?: Inner option
                    }
            }
            Fallback
        `);
        const enter = choose(root, 'Enter');
        const inner = choose(enter, 'Inner option');
        expect(inner.text).toBe('Fallback');
    });

    it('basic options with fallback', () => {
        const root = compile(`
            Hello,
            How are you? {
                ?: Good
                    Great!
                ?: Bad
                    Sorry!
            }
            Fallback
        `);
        //console.log(root)
        const next = ('next' in root) ? root.next : null;
        if(!next) throw new Error("Root next not attached!")
        expect(optionTexts(next)).toEqual(['Good', 'Bad']);
        const good = choose(next, 'Good');
        expect(good.text).toBe('Great!');
        expect(trace(good)).toEqual(['Great!', 'Fallback']);
        const bad = choose(next, 'Bad');
        expect(trace(bad)).toEqual(['Sorry!', 'Fallback']);
    });
});

describe('skip blocks', () => {
    it('skip block is transparent to surrounding chain', () => {
        const root = compile(`
            Hello
            [block:skip]
                Inner
            [/block]
            Goodbye
        `);
        expect(trace(root)).toEqual(['Hello', 'Goodbye']);
    });

    it('label inside skip block is reachable via goto', () => {
        const root = compile(`
            -> inner
            [block:skip]
                @inner
                Inner text
            [/block]
            After
        `);
        expect(root.text).toBe('Inner text');
    });

    it('skip block body falls through to surrounding next', () => {
        const root = compile(`
            -> skip
            [block:skip]
                Inside
            [/block]
            After
        `);
        const inside = root; // root is Inside since we goto skip
        expect(inside.text).toBe('Inside');
        expect(trace(inside)).toEqual(['Inside', 'After']);
    });
});