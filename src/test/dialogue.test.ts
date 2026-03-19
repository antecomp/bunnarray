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


describe('directives', () => {
    it('face directive is extracted', () => {
        const root = compile('Hello <face:smile>');
        expect(root.text).toBe('Hello');
        expect(root.face).toBe('smile');
    });

    it('signal directive is extracted', () => {
        const root = compile('Hello <signal:something>');
        expect(root.text).toBe('Hello');
        expect(root.signals).toContain('something');
    });

    it('multiple signals on one node', () => {
        const root = compile('Hello <signal:a> <signal:b>');
        expect(root.signals).toContain('a');
        expect(root.signals).toContain('b');
    });

    it('directives still work on options', () => {
        const root = compile(`
            Hello <face:smile> <signal:a> {
                ?: Cya
            }
            Goodbye
        `);

        expect(root.face).toBe('smile');
        expect(root.signals).toContain('a');
    })
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
        if (!next) throw new Error("Root next not attached!")
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

describe('match blocks', () => {
    it('basic match routes to correct branch', () => {
        const root = compile(`
            Check this
            [match:func]
                =a
                    Got A
                =b
                    Got B
            [/match]
            After
        `);
        expect('match' in root).toBe(true);
        const a = navigateMatch(root, 'a') as DialogueNode;
        expect(a.text).toBe('Got A');
        expect(trace(a)).toEqual(['Got A', 'After']);
    });

    it('match with no result uses fallback node', () => {
        const root = compile(`
            Check
            [match:func]
                =a
                    Got A
            [/match]
            Fallback
        `);
        const match = (root as any).match as DialogueMatch;
        expect(match.fallback).toBeDefined();
        const fallback = match.fallback as DialogueNode;
        expect(fallback.text).toBe('Fallback');
    });

    it('chained match tries next match on failure', () => {
        const root = compile(`
            Check
            [match:funcA]
                =a
                    Got A from first
            [/match]
            [match:funcB]
                =b
                    Got B from chain
            [/match]
            Final fallback
        `);
        const matchA = (root as any).match as DialogueMatch;
        expect(matchA.fallback).toBeDefined();
        const chainB = matchA.fallback as DialogueMatch;
        expect(chainB.on).toBe('funcB');
    });

    it('match branch with sequence then nested match', () => {
        const root = compile(`
            Check
            [match:funcA]
                =a
                    Some text
                    [match:funcB]
                        =b
                            Got B
                    [/match]
            [/match]
            After
        `);
        const a = navigateMatch(root, 'a') as DialogueNode;
        expect(a.text).toBe('Some text');
        expect('match' in a).toBe(true);
        const b = navigateMatch(a, 'b');
        expect(trace(b as DialogueNode)).toEqual(['Got B', 'After']);
    });

    it('nested match escapes to parent chain on failure', () => {
        const root = compile(`
            Check
            [match:funcA]
                =a
                    [match:funcX]
                        =fail
                            Should not see
                    [/match]
            [/match]
            [match:funcB]
                =b
                    Got B via chain
            [/match]
            Final
        `);
        const matchA = (root as any).match as DialogueMatch;
        const innerMatch = matchA.matches['a'] as DialogueMatch;
        expect(innerMatch.fallback).toBeDefined();
        const chainB = innerMatch.fallback as DialogueMatch;
        expect(chainB.on).toBe('funcB');
    });
});

describe('option and match combinations', () => {
    it('option block with blockMatch fallback', () => {
        const root = compile(`
            Prompt {
                ?: Option
                    Here we go!
            }
            [match:func]
                =a
                    Match result
            [/match]
            After
        `);
        console.log(root);
        const option = choose(root, 'Option');
        expect(option.text).toBe('Here we go!');
        expect('match' in option).toBe(true);
    });

    it('empty option branch with blockMatch leads directly to match', () => {
        const root = compile(`
            Prompt {
                ?: Send it!
            }
            [match:func]
                =a
                    We should see this
            [/match]
            After
        `);
        if (!('options' in root)) throw new Error();
        const opt = root.options[0];
        expect('match' in opt).toBe(true);
    });

    it('option goto wins over blockMatch', () => {
        const root = compile(`
            Prompt {
                ?: Jump
                    -> end
            }
            [match:func]
                =a
                    Should not reach
            [/match]
            @end
            End
        `);
        const jump = choose(root, 'Jump');
        expect(jump.text).toBe('End');
    });

    it('nested option inside branch threads blockMatch down', () => {
        const root = compile(`
            Outer {
                ?: Enter
                    Inner {
                        ?: Inner option
                    }
            }
            [match:func]
                =a
                    Match result
            [/match]
            After
        `);
        const enter = choose(root, 'Enter');
        const inner = choose(enter, 'Inner option');
        // inner option should lead to match, not After directly
        expect('match' in inner).toBe(true);
    });

    it('chained blockMatch', () => {
        const root = compile(`
            Prompt {
                ?: Option
            }
            [match:funcA]
                =a
                    Got A
            [/match]
            [match:funcB]
                =b
                    Got B
            [/match]
            After
        `);
        if (!('options' in root)) throw new Error();
        const opt = root.options[0];
        expect('match' in opt).toBe(true);
        const matchA = (opt as any).match as DialogueMatch;
        expect(matchA.fallback).toBeDefined();
        const chainB = matchA.fallback as DialogueMatch;
        expect(chainB.on).toBe('funcB');
    });
});

