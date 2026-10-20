/** End-to-end checks from BunNarraY source through preprocessing, parsing, and IR lowering. */
import { describe, expect, it } from 'vitest';
import build from '../build';
import type { Instruction } from '../instructions';

function expectIR(source: string, instructions: Instruction[]) {
    expect(build(source)).toEqual({ instructions });
}

describe('build', () => {
    describe('basic text and comments', () => {
        it('emits a SAY per line and terminates with END', () => {
            expectIR(`Hello, it has been a while,
how has life been treating you?`, [
                { op: 'SAY', text: 'Hello, it has been a while,' },
                { op: 'SAY', text: 'how has life been treating you?' },
                { op: 'END' },
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
                { op: 'END' },
            ]);
        });

        it('accepts Windows line endings and a final newline', () => {
            expectIR('First.\r\n\r\n  Second.  \r\n', [
                { op: 'SAY', text: 'First.' },
                { op: 'SAY', text: 'Second.' },
                { op: 'END' },
            ]);
        });

        it('keeps a hash within dialogue text', () => {
            expectIR('The key is #1.', [
                { op: 'SAY', text: 'The key is #1.' },
                { op: 'END' },
            ]);
        });
    });

    describe('options and fallbacks', () => {
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
                    { text: 'bad', target: 4 },
                ] },
                { op: 'SAY', text: 'cool.' },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'not cool' },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'Well, anyways... the dialogue continues here...' },
                { op: 'END' },
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
                    { text: 'something', target: 3 },
                ] },
                { op: 'JUMP', target: 6 },
                { op: 'SAY', text: 'One line.' },
                { op: 'SAY', text: 'Another line.' },
                { op: 'JUMP', target: 6 },
                { op: 'END' },
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
                    { text: 'leave', target: 10 },
                ] },
                { op: 'SAY', text: 'Inner' },
                { op: 'CHOICE', choices: [
                    { text: 'left', target: 4 },
                    { text: 'right', target: 6 },
                ] },
                { op: 'SAY', text: 'Left path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Right path.' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Back from exploring.' },
                { op: 'JUMP', target: 12 },
                { op: 'SAY', text: 'Leaving.' },
                { op: 'JUMP', target: 12 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'END' },
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
                    { text: 'Bad', target: 8 },
                ] },
                { op: 'CHOICE', choices: [
                    { text: 'Really good', target: 3 },
                    { text: 'Mostly good', target: 5 },
                ] },
                { op: 'SAY', text: 'Wonderful!' },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'Glad to hear it.' },
                { op: 'JUMP', target: 7 },
                { op: 'JUMP', target: 10 },
                { op: 'SAY', text: 'Sorry to hear that.' },
                { op: 'JUMP', target: 10 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'END' },
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
                    { op: 'CHOICE', choices: [{ text: 'Good', target: 2 }] },
                    { op: 'CHOICE', choices: [
                        { text: 'Really good', target: 3 },
                        { text: 'Mostly good', target: 5 },
                    ] },
                    { op: 'SAY', text: 'Wonderful!' },
                    { op: 'JUMP', target: 7 },
                    { op: 'SAY', text: 'Glad to hear it.' },
                    { op: 'JUMP', target: 7 },
                    { op: 'JUMP', target: 8 },
                    { op: 'CHOICE', choices: [{ text: 'How about you?', target: 9 }] },
                    { op: 'SAY', text: 'Oh! I am just great, personally!' },
                    { op: 'JUMP', target: 11 },
                    { op: 'END' },
                ]);
            },
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
                { op: 'END' },
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
                { op: 'CHOICE', choices: [{ text: 'good', target: 4 }] },
                { op: 'SAY', text: 'Great!' },
                { op: 'JUMP', target: 6 },
                { op: 'END' },
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
                    { text: 'ask me how I am', target: 4 },
                ] },
                { op: 'JUMP', target: 8 },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'okay fine, I will!' },
                { op: 'JUMP', target: 9 },
                { op: 'JUMP', target: 7 },
                { op: 'SAY', text: 'Common fallback.' },
                { op: 'SAY', text: 'Lovely weather!' },
                { op: 'SAY', text: 'How are you?' },
                { op: 'END' },
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
                { op: 'END' },
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
                { op: 'END' },
            ]);
        });
    });

    describe('match blocks', () => {
        it('maps return strings to case entries and joins cases and unmatched results at the fallback', () => {
            expectIR(`Well, that depends on if the dragon is slain...
                [match:dragon]
                    =slain
                        What? The dragon is slain? That is fantastic!
                        Here is all of my money!!!
                    =notslain
                        The dragon is still alive and I live in fear.
                        Please slay the dragon and come back later
                [/match]
                Goodbye!`, [
                { op: 'SAY', text: 'Well, that depends on if the dragon is slain...' },
                { op: 'MATCH', on: 'dragon', cases: { slain: 2, notslain: 5 }, fallback: 8 },
                { op: 'SAY', text: 'What? The dragon is slain? That is fantastic!' },
                { op: 'SAY', text: 'Here is all of my money!!!' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'The dragon is still alive and I live in fear.' },
                { op: 'SAY', text: 'Please slay the dragon and come back later' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'END' },
            ]);
        });

        it('compiles nested conditions and chains their fallbacks into the next match', () => {
            expectIR(`[match:conditionOne]
                =a
                    [match:nestedCondition]
                        =yes
                            Both conditions passed.
                    [/match]
            [/match]
            [match:conditionTwo]
                =noodles
                    Yum!
            [/match]`, [
                { op: 'MATCH', on: 'conditionOne', cases: { a: 1 }, fallback: 5 },
                { op: 'MATCH', on: 'nestedCondition', cases: { yes: 2 }, fallback: 4 },
                { op: 'SAY', text: 'Both conditions passed.' },
                { op: 'JUMP', target: 4 },
                { op: 'JUMP', target: 5 },
                { op: 'MATCH', on: 'conditionTwo', cases: { noodles: 6 }, fallback: 8 },
                { op: 'SAY', text: 'Yum!' },
                { op: 'JUMP', target: 8 },
                { op: 'END' },
            ]);
        });

        it('allows a case goto to bypass the match fallback', () => {
            expectIR(`[match:dragon]
                =slain
                    ->reward
                =notslain
                    Please slay the dragon.
            [/match]
            Goodbye!
            ->done
            @reward
            Here is all of my money!!!
            @done`, [
                { op: 'MATCH', on: 'dragon', cases: { slain: 1, notslain: 3 }, fallback: 5 },
                { op: 'JUMP', target: 7 },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'Please slay the dragon.' },
                { op: 'JUMP', target: 5 },
                { op: 'SAY', text: 'Goodbye!' },
                { op: 'JUMP', target: 8 },
                { op: 'SAY', text: 'Here is all of my money!!!' },
                { op: 'END' },
            ]);
        });
    });

    // TODO Directives/Signals if those become directly incorporated as instructions.
});
