/** End-to-end checks from BunNarraY source through preprocessing, parsing, and IR lowering. */
import { describe, expect, it } from 'vitest';
import example from '../../../../examples/example.bny?raw';
import main from '../../../../examples/main.bny?raw';
import simple from '../../../../examples/simple.bny?raw';
import testbranch from '../../../../examples/testbranch.bny?raw';
import { build } from '../build';
import type { Instruction } from '@bunnarray/vm';
import { DialogueLexer, Text } from '../language/lexer';
import preprocess from '../language/preprocess';

function expectIR(source: string, instructions: Instruction[]) {
    expect(build(source)).toEqual({ version: { major: 1, minor: 0, patch: 'indev' }, instructions });
}

describe('build', () => {
    it.each([
        ['example.bny', example],
        ['main.bny', main],
        ['simple.bny', simple],
        ['testbranch.bny', testbranch]
    ])('compiles migrated example %s', (_name, source) => {
        const { instructions } = build(source);
        expect(instructions[instructions.length - 1]).toEqual({ op: 'END' });
    });

    describe('basic text and comments', () => {
        it('emits a SAY per line and terminates with END', () => {
            expectIR(`Hello, it has been a while,
how has life been treating you?`, [
                { op: 'SAY', text: 'Hello, it has been a while,' },
                { op: 'SAY', text: 'how has life been treating you?' },
                { op: 'END' }
            ]);
        });

        it.each(['', '\n  \n', '# Only a comment\n    # Another comment'])
        ('terminates an empty or comment-only script: %j', source => {
            expectIR(source, [{ op: 'END' }]);
        });

        it('removes blank lines, indentation, and whole-line comments', () => {
            expectIR(`
                # At this point in the story, she probably hates you.

                I hate you!
                # This should not become dialogue.
                Go away!
            `, [
                { op: 'SAY', text: 'I hate you!' },
                { op: 'SAY', text: 'Go away!' },
                { op: 'END' }
            ]);
        });

        it('accepts Windows line endings and a final newline', () => {
            expectIR('First.\r\n\r\n  Second.  \r\n', [
                { op: 'SAY', text: 'First.' },
                { op: 'SAY', text: 'Second.' },
                { op: 'END' }
            ]);
        });

        it('accepts inline comments and an escaped literal hash', () => {
            expectIR('The key is &hash;1. # explain the key\nNext line. # and this', [
                { op: 'SAY', text: 'The key is #1.' },
                { op: 'SAY', text: 'Next line.' },
                { op: 'END' }
            ]);
        });

        it('keeps original token positions across blank and comment lines', () => {
            const source = '  # note\n\u00a0\n  First # inline\n\u00a0# skip\n  Second &hash;2';
            const lex = DialogueLexer.tokenize(preprocess(source));

            expect(lex.errors).toEqual([]);
            expect(lex.tokens.filter(token => token.tokenType === Text)
                .map(token => [token.image, token.startLine, token.startColumn]))
                .toEqual([
                    ['First ', 3, 3],
                    ['Second &hash;2', 5, 3]
                ]);
            expectIR(source, [
                { op: 'SAY', text: 'First' },
                { op: 'SAY', text: 'Second #2' },
                { op: 'END' }
            ]);
        });

        it('decodes bracket escapes after parsing and preserves escaped ampersands', () => {
            expectIR('Say &lbrack;yes&rbrack; and &lbrace;maybe&rbrace;. Write &amp;lbrace; literally.', [
                { op: 'SAY', text: 'Say [yes] and {maybe}. Write &lbrace; literally.' },
                { op: 'END' }
            ]);
        });
    });

    describe('alternating speakers', () => {
        it('splits semicolon-separated names and accepts a bare directive to stop', () => {
            expectIR(':ALTERNATE Alice; Bob Smith ;Carol\n:SPEAKER Other\n:ALTERNATE', [
                { op: 'ALTERNATE', speakers: ['Alice', 'Bob Smith', 'Carol'] },
                { op: 'SPEAKER', value: 'Other' },
                { op: 'ALTERNATE', speakers: [] },
                { op: 'END' }
            ]);
        });

        it('keeps text escapes inside speaker names', () => {
            expectIR(':ALTERNATE Alice &amp; Bob; &lbrack;Guard&rbrack;; &amp;lbrace;', [
                { op: 'ALTERNATE', speakers: ['Alice & Bob', '[Guard]', '&lbrace;'] },
                { op: 'END' }
            ]);
        });

        it.each([
            ':ALTERNATE ;Alice',
            ':ALTERNATE Alice;;Bob',
            ':ALTERNATE Alice; ;Bob',
            ':ALTERNATE Alice;'
        ])('rejects an empty speaker in %j', source => {
            expect(() => build(source)).toThrow('ALTERNATE requires a speaker between each semicolon');
        });
    });

    describe('options and fallbacks', () => {
        it('retains choice IDs and leaves untagged choices without an ID', () => {
            const { instructions } = build(`{
                ?: [id:first] First
                ?: [when:ready=yes] [id:second] Second
                ?: Plain
            }`);
            const choice = instructions.find(instruction => instruction.op === 'CHOICE');
            if (choice?.op !== 'CHOICE') throw new Error('Expected a CHOICE instruction');

            expect(choice.choices.map(({ id, text }) => ({ id, text }))).toEqual([
                { id: 'first', text: 'First' },
                { id: 'second', text: 'Second' },
                { id: undefined, text: 'Plain' }
            ]);
            expect(choice.choices[2]).not.toHaveProperty('id');
        });

        it('keeps optional conditions on their own choices and records the no-choice fallback', () => {
            expectIR(`Ask? {
                ?: [when:state=ready] Ready
                    Ready path.
                ?: Always
                    Always path.
                ?: [when:other=yes] Other
                    Other path.
            }
            After.`, [
                { op: 'SAY', text: 'Ask?' },
                { op: 'CHOICE', choices: [
                    { text: 'Ready', target: 2, condition: { identifier: 'state', value: 'ready' } },
                    { text: 'Always', target: 4 },
                    { text: 'Other', target: 6, condition: { identifier: 'other', value: 'yes' } }
                ], fallback: 8 },
                { op: 'SAY', text: 'Ready path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Always path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Other path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'After.' },
                { op: 'END' }
            ]);
        });

        it('decodes escapes and skips comments inside choices', () => {
            expectIR(`Choose &lbrace;one&rbrace; { # prompt note
                # option note

                ?: &lbrack;yes&rbrack; # selection note
                    Done.
            } # end note`, [
                { op: 'SAY', text: 'Choose {one}' },
                { op: 'CHOICE', choices: [{ text: '[yes]', target: 2 }], fallback: 4 },
                { op: 'SAY', text: 'Done.' },
                { op: 'JUMP', target: 4 },
                { op: 'END' }
            ]);
        });

        it('compiles the prompt and makes both branches fall through after the choice', () => {
            expectIR(`How are you? {
                ?: good
                    cool.
                ?: bad
                    not cool
            }
            Well, anyways... the dialogue continues here...`, [
                { op: 'SAY', text: 'How are you?' },
                { op: 'CHOICE', choices: [
                    { text: 'good', target: 2 },
                    { text: 'bad', target: 4 }
                ], fallback: 6 },
                { op: 'SAY', text: 'cool.' },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'not cool' },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'Well, anyways... the dialogue continues here...' },
                { op: 'END' }
            ]);
        });

        it('lets an empty option fall through and sends terminal options to END', () => {
            expectIR(`Choose{
                ?: nothing
                ?: something
                    One line.
                    Another line.
            }`, [
                { op: 'SAY', text: 'Choose' },
                { op: 'CHOICE', choices: [
                    { text: 'nothing', target: 2 },
                    { text: 'something', target: 3 }
                ], fallback: 6 },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'One line.' },
                { op: 'SAY', text: 'Another line.' },
                { op: 'JUMP', target: 6 },
                { op: 'END' }
            ]);
        });

        it('returns nested options to their enclosing branch before the outer fallback', () => {
            expectIR(`Outer{
                ?: explore
                    Inner{
                        ?: left
                            Left path.
                        ?: right
                            Right path.
                    }
                    Back from exploring.
                ?: leave
                    Leaving.
            }
            Goodbye!`, [
                { op: 'SAY', text: 'Outer' },
                { op: 'CHOICE', choices: [
                    { text: 'explore', target: 2 },
                    { text: 'leave', target: 10 }
                ], fallback: 12 },
                { op: 'SAY', text: 'Inner' },
                { op: 'CHOICE', choices: [
                    { text: 'left', target: 4 },
                    { text: 'right', target: 6 }
                ], fallback: 8 },
                { op: 'SAY', text: 'Left path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Right path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Back from exploring.' },
                { op: 'JUMP', target: 12 },
                { op: 'SAY', text: 'Leaving.' },
                { op: 'JUMP', target: 12 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'END' }
            ]);
        });

        it('enters nested choices without emitting or repeating a prompt', () => {
            expectIR(`How are you? {
                ?: Good
                    {
                        ?: Really good
                            Wonderful!
                        ?: Mostly good
                            Glad to hear it.
                    }
                ?: Bad
                    Sorry to hear that.
            }
            Goodbye!`, [
                { op: 'SAY', text: 'How are you?' },
                { op: 'CHOICE', choices: [
                    { text: 'Good', target: 2 },
                    { text: 'Bad', target: 8 }
                ], fallback: 10 },
                { op: 'CHOICE', choices: [
                    { text: 'Really good', target: 3 },
                    { text: 'Mostly good', target: 5 }
                ], fallback: 7 },
                { op: 'SAY', text: 'Wonderful!' },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'Glad to hear it.' },
                { op: 'JUMP', target: 7 },
                { op: 'JUMP', target: 10 },
                { op: 'SAY', text: 'Sorry to hear that.' },
                { op: 'JUMP', target: 10 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'END' }
            ]);
        });
    });

    describe('chained choices', () => {
        it.each(['\n', ' ', '\t   '])(
            'trims inline prompts and options and ignores whitespace between blocks: %j',
            separator => {
                expectIR(`How are you? {
                    ?: Good   {
                        ?: Really good
                            Wonderful!
                        ?: Mostly good
                            Glad to hear it.
                    }
                }${separator}{
                    ?: How about you?
                        Oh! I am just great, personally!
                }`, [
                    { op: 'SAY', text: 'How are you?' },
                    { op: 'CHOICE', choices: [{ text: 'Good', target: 2 }], fallback: 8 },
                    { op: 'CHOICE', choices: [
                        { text: 'Really good', target: 3 },
                        { text: 'Mostly good', target: 5 }
                    ], fallback: 7 },
                    { op: 'SAY', text: 'Wonderful!' },
                    { op: 'JUMP', target: 7 },
                    { op: 'SAY', text: 'Glad to hear it.' },
                    { op: 'JUMP', target: 7 },
                    { op: 'JUMP', target: 8 },
                    { op: 'CHOICE', choices: [{ text: 'How about you?', target: 9 }], fallback: 11 },
                    { op: 'SAY', text: 'Oh! I am just great, personally!' },
                    { op: 'JUMP', target: 11 },
                    { op: 'END' }
                ]);
            }
        );
    });

    describe('labels and gotos', () => {
        it('resolves forward and backward gotos without emitting label instructions', () => {
            expectIR(`->later
                @earlier
                Lovely weather we are having!
                ->later
                @later
                How are you?
                ->earlier`, [
                { op: 'JUMP', target: 3 },
                { op: 'SAY', text: 'Lovely weather we are having!' },
                { op: 'JUMP', target: 3 },
                { op: 'SAY', text: 'How are you?' },
                { op: 'JUMP', target: 1 },
                { op: 'END' }
            ]);
        });

        it('resolves a goto to the prompt of a labeled choice', () => {
            expectIR(`->howareyou
                Skipped on entry.
                @howareyou
                How are you?{
                    ?: good
                        Great!
                }`, [
                { op: 'JUMP', target: 2 },
                { op: 'SAY', text: 'Skipped on entry.' },
                { op: 'SAY', text: 'How are you?' },
                { op: 'CHOICE', choices: [{ text: 'good', target: 4 }], fallback: 6 },
                { op: 'SAY', text: 'Great!' },
                { op: 'JUMP', target: 6 },
                { op: 'END' }
            ]);
        });

        it('lets an explicit goto in an option bypass the common fallback', () => {
            expectIR(`Where to?{
                ?: weather
                    -> weather
                ?: ask me how I am
                    okay fine, I will!
                    -> how are you
            }
            Common fallback.
            @weather
            Lovely weather!
            @how are you
            How are you?`, [
                { op: 'SAY', text: 'Where to?' },
                { op: 'CHOICE', choices: [
                    { text: 'weather', target: 2 },
                    { text: 'ask me how I am', target: 4 }
                ], fallback: 7 },
                { op: 'JUMP', target: 8 },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'okay fine, I will!' },
                { op: 'JUMP', target: 9 },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'Common fallback.' },
                { op: 'SAY', text: 'Lovely weather!' },
                { op: 'SAY', text: 'How are you?' },
                { op: 'END' }
            ]);
        });
    });

    describe('skip blocks', () => {
        it('skips the block linearly, enters by label, and resolves its exit goto', () => {
            expectIR(`Lets test the skip block...
                [skip:xxx]
                    and this second
                    ->xxxdone
                [/skip]
                You should see this first
                ->xxx
                @xxxdone
                And finally we're here.`, [
                { op: 'SAY', text: 'Lets test the skip block...' },
                { op: 'JUMP', target: 4 },
                { op: 'SAY', text: 'and this second' },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'You should see this first' },
                { op: 'JUMP', target: 2 },
                { op: 'SAY', text: "And finally we're here." },
                { op: 'END' }
            ]);
        });

        it('allows an entered skip block to fall through to the following text', () => {
            expectIR(`->optional
                [skip:optional]
                    Optional preface.
                [/skip]
                Main dialogue.`, [
                { op: 'JUMP', target: 2 },
                { op: 'JUMP', target: 3 },
                { op: 'SAY', text: 'Optional preface.' },
                { op: 'SAY', text: 'Main dialogue.' },
                { op: 'END' }
            ]);
        });
    });

    describe('branch blocks', () => {
        it('compiles nested branches followed by another branch', () => {
            expectIR(`[branch]
                [when:conditionOne=a]
                    [branch]
                        [when:nestedCondition=yes]
                            Both conditions passed.
                    [/branch]
            [/branch]
            [branch]
                [when:conditionTwo=noodles]
                    Yum!
            [/branch]`, [
                { op: 'BRANCH', cases: [{ condition: { identifier: 'conditionOne', value: 'a' }, target: 1 }], fallback: 5 },
                { op: 'BRANCH', cases: [{ condition: { identifier: 'nestedCondition', value: 'yes' }, target: 2 }], fallback: 4 },
                { op: 'SAY', text: 'Both conditions passed.' },
                { op: 'JUMP', target: 4 },
                { op: 'JUMP', target: 5 },
                { op: 'BRANCH', cases: [{ condition: { identifier: 'conditionTwo', value: 'noodles' }, target: 6 }], fallback: 8 },
                { op: 'SAY', text: 'Yum!' },
                { op: 'JUMP', target: 8 },
                { op: 'END' }
            ]);
        });

        it('allows a case goto to bypass the branch fallback', () => {
            expectIR(`[branch]
                [when:dragon=slain]
                    ->reward
                [when:dragon=notslain]
                    Please slay the dragon.
            [/branch]
            Goodbye!
            ->done
            @reward
            Here is all of my money!!!
            @done`, [
                { op: 'BRANCH', cases: [
                    { condition: { identifier: 'dragon', value: 'slain' }, target: 1 },
                    { condition: { identifier: 'dragon', value: 'notslain' }, target: 3 }
                ], fallback: 5 },
                { op: 'JUMP', target: 7 },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'Please slay the dragon.' },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Here is all of my money!!!' },
                { op: 'END' }
            ]);
        });

        it('compiles ordered conditions on different identifiers and joins cases at the fallback', () => {
            expectIR(`[branch]
                [when:flag = yes]
                    First.
                [when:other=go]
                    Second.
            [/branch]
            After.`, [
                { op: 'BRANCH', cases: [
                    { condition: { identifier: 'flag', value: 'yes' }, target: 1 },
                    { condition: { identifier: 'other', value: 'go' }, target: 3 }
                ], fallback: 5 },
                { op: 'SAY', text: 'First.' },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'Second.' },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'After.' },
                { op: 'END' }
            ]);
        });

        it('decodes condition values and lets an empty case fall through', () => {
            expectIR(`[branch]
                [when:state=&lbrack;ready&rbrack;]
                [when:other=yes]
                    Second.
            [/branch]
            After.`, [
                { op: 'BRANCH', cases: [
                    { condition: { identifier: 'state', value: '[ready]' }, target: 1 },
                    { condition: { identifier: 'other', value: 'yes' }, target: 2 }
                ], fallback: 4 },
                { op: 'JUMP', target: 4 },
                { op: 'SAY', text: 'Second.' },
                { op: 'JUMP', target: 4 },
                { op: 'SAY', text: 'After.' },
                { op: 'END' }
            ]);
        });
    });

    describe('directives and signals', () => {
        it('trims values before inline comments and decodes literal hashes', () => {
            expectIR(`:SPEAKER Alice  # speaker note
                :SET code=&hash;1  # assignment note
                :SIGNAL key: &hash;2  # signal note
                :YIELD wait: &hash;3  # yield note`, [
                { op: 'SPEAKER', value: 'Alice' },
                { op: 'SET', identifier: 'code', value: '#1' },
                { op: 'SIGNAL', identifier: 'key', value: '#2' },
                { op: 'YIELD', identifier: 'wait', value: '#3' },
                { op: 'END' }
            ]);
        });

        it('compiles assignments and removals in source order', () => {
            expectIR(`:SET state=ready
                :SET _quest2=&lbrack;open&rbrack; &amp; waiting
                :SET state
                Continue.`, [
                { op: 'SET', identifier: 'state', value: 'ready' },
                { op: 'SET', identifier: '_quest2', value: '[open] & waiting' },
                { op: 'SET', identifier: 'state', value: undefined },
                { op: 'SAY', text: 'Continue.' },
                { op: 'END' }
            ]);
        });

        it('keeps optional signal and yield values distinct from their identifiers', () => {
            expectIR(`:SIGNAL opened
                :SIGNAL quest:complete
                :YIELD inspect
                :YIELD action: front &amp; back
                Done.`, [
                { op: 'SIGNAL', identifier: 'opened', value: undefined },
                { op: 'SIGNAL', identifier: 'quest', value: 'complete' },
                { op: 'YIELD', identifier: 'inspect', value: undefined },
                { op: 'YIELD', identifier: 'action', value: 'front & back' },
                { op: 'SAY', text: 'Done.' },
                { op: 'END' }
            ]);
        });

        it('sets a speaker and restores the narrator with a bare directive', () => {
            expectIR(`:SPEAKER Alice &amp; Bob
                Hello.
                :SPEAKER
                Narration.`, [
                { op: 'SPEAKER', value: 'Alice & Bob' },
                { op: 'SAY', text: 'Hello.' },
                { op: 'SPEAKER', value: null },
                { op: 'SAY', text: 'Narration.' },
                { op: 'END' }
            ]);
        });

        it('places directives inside a choice before its common fallback', () => {
            expectIR(`Choose. {
                ?: Accept
                    :SET accepted=yes
                    :SIGNAL choice:accepted
                    :YIELD save
            }
            After.`, [
                { op: 'SAY', text: 'Choose.' },
                { op: 'CHOICE', choices: [{ text: 'Accept', target: 2 }], fallback: 6 },
                { op: 'SET', identifier: 'accepted', value: 'yes' },
                { op: 'SIGNAL', identifier: 'choice', value: 'accepted' },
                { op: 'YIELD', identifier: 'save', value: undefined },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'After.' },
                { op: 'END' }
            ]);
        });
    });

    it('keeps variable references and inline tags as dialogue text', () => {
        expectIR('Hey, $name.', [
            { op: 'SAY', text: 'Hey, $name.' },
            { op: 'END' }
        ]);
    });

    it('rejects gotos to missing labels and duplicate labels', () => {
        expect(() => build('->missing')).toThrow('encountered goto to unknown label missing');
        expect(() => build('@same\nFirst.\n@same\nSecond.')).toThrow('duplicate label');
    });

    it('reports lexer and parser errors at their source positions', () => {
        expect(() => build('  # skip\n\n  :SET 1bad'))
            .toThrow(/Lex error at line 3, column 8: /);
        expect(() => build('  # skip\n\n{\n  Plain\n}'))
            .toThrow(/Parse error at line 4, column 3: /);
        expect(() => build('  # skip\n\n{\n  ?: Yes'))
            .toThrow(/Parse error at line 5, column 1: /);
    });
});
