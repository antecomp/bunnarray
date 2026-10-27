# Writing Dialogue

BunNarraY scripts contain dialogue lines, directives, and blocks. Blank lines and indentation are ignored; braces and brackets delimit blocks. The examples below use `.bny` source.

### Basic Text
Each normal line of text becomes a separate dialogue message when the VM runs.
Leading and trailing whitespace on a dialogue line is removed.
Square brackets (`[` and `]`) and curly braces (`{` and `}`) are reserved for language syntax. To include them literally in text, use `&lbrack;`, `&rbrack;`, `&lbrace;`, and `&rbrace;`, respectively. These escapes also work in option text and other text fields. Use `&hash;` for a literal `#` and `&amp;` to write a literal escape sequence, such as `&amp;lbrace;` for the text `&lbrace;`.
```
Hello, it has been a while,
how has life been treating you?
The answer is &lbrace;maybe&rbrace;.
```

### Speakers
Use `:SPEAKER name` on its own line to set the speaker for the following dialogue lines. The name carries forward until another speaker directive changes it. Use `:SPEAKER` by itself to return to the narrator.
```
:SPEAKER Alice
Hello!
Still Alice speaking.
:SPEAKER
The story continues.
```
Each `say` emission includes the speaker name, or `null` for the narrator.

Use `:ALTERNATE` with semicolon-separated names to rotate speakers on each dialogue line. Names may contain spaces. A bare `:ALTERNATE` stops the rotation and leaves the last speaker in place. `:SPEAKER` also stops the rotation and sets a new speaker. Only dialogue lines advance the rotation.
```
:ALTERNATE Alice; Bob Smith
Hello!
Hi!
Hello again!
:ALTERNATE
Still Alice speaking.
```
The first three lines are spoken by Alice, Bob Smith, and Alice, respectively.
An empty name, such as in `:ALTERNATE Alice;;Bob`, selects the narrator (null) for that turn.

### Comments
Use `#` to comment out the rest of a line. It can follow a statement or appear on a line by itself. Use `&hash;` for a literal `#` in dialogue text or a value.
```
# At this point in the story, she probably hates you.
I hate you! # This note is ignored.
```

### Options (Player Choices)
Options (branching dialogue based on player responses) are defined with curly braces. The text before the opening brace is the **prompt text**, displayed as dialogue. The text after each `?:` is the **option text**, which the player selects:
```
prompt {
    ?: option text
        ...
    ?: another option
        ...
}
```
Within an option body can be dialogue lines, nested choices, directives, branches, and gotos. Option text is a selectable response; it does not become a new prompt. A choice block needs at least one `?:` option. The prompt is optional, but the opening `{` must be followed by a newline.
> TODO rewrite this, prompt text isn't some magical attachment, it's emitted all the same, we're just changing the continue model from next-line to please-select for a moment. 

A nested question can supply its own prompt:
```
How are you? {
    ?: Good
        What made today good? {
            ?: The weather
                Lovely!
            ?: Seeing you
                Aw!
        }
    ?: Bad
        Sorry to hear that.
}
```

To present another set of choices without displaying a new prompt, put a bare choice block inside an option:
```
How are you? {
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
```
Selecting "Good" goes directly to the inner choices. 
> Every `?:` still needs option text; `?: {` is not valid syntax.

Choice blocks can also follow one another, each with its own options. A bare block after a prompted block presents another choice without speaking a new prompt.

Prefix an option with `[when:identifier=value]` to show it only when that memory value matches. Options without a condition are always shown:
```bny
What should we do? {
    ?: [when:has_key=yes] Open the door
        The door opens.
    ?: Leave
        We turn back.
}
```
Conditions are checked when the VM reaches the choice. Every matching option is shown in its original order. If none are available, the VM continues after the choice block without showing an empty option list; a preceding prompt is still spoken as dialogue.

Prefix an option with `[id:name]` to attach an identifier to the option emitted by the VM:
```bny
Where next? {
    ?: [id:garden] Garden
        Let's go outside.
    ?: [when:has_key=yes] [id:cellar] Cellar
        The key fits.
}
```
`[id:...]` and `[when:...]` can appear in either order before the option text. IDs are optional strings; the VM does not use them to choose a branch. The `options` emission contains entries such as `{ text: 'Garden', id: 'garden' }`, with `id` absent for untagged options. Call `vm.choose(index)` with the **zero-based index in the visible option list**, after the VM returns `'select'`. Hidden options do not occupy an index. Option text and IDs are fixed strings; `$variables` in them are not interpolated.

### Labels and Gotos
A label marks a position in the script; it does not emit dialogue. Put `@label` before any statement you want to jump to. For example:
```bny
@weather
Lovely weather we are having!

@howareyou
How are you? {
    ?: Good
        Glad to hear it.
}
```
Jump to a label with `->label` on its own line:
```bny
Blah blah blah
Say, I never asked you how you were...
->howareyou
```
After the second line, execution jumps to the earlier "How are you?" question. Gotos can target labels before or after themselves. A label can also be inside an option body or branch case. Label names are trimmed text and must be unique; a goto to an unknown label fails compilation.

### Fallbacks
An option can end with a goto, such as `->weather` or `->howareyou` for the labels above. Without a goto, the selected option continues after the closing brace, skipping the other option bodies:
```bny
How are you? {
    ?: good
        cool.
    ?: bad
        not cool
}
Well, anyways... the dialogue continues here...
```
"Well, anyways..." follows either answer.

### Skip Blocks
Linear execution jumps over a skip block. Jump to its label to run its contents:
```bny
[skip:label]
    Optional dialogue.
[/skip]
```
The label on `[skip:label]` is defined at the first statement inside the block. When entered, execution continues after `[/skip]` unless a goto redirects it. For example:
```bny
Let's test the skip block...
[skip:xxx]
    This line appears only after the goto below.
    ->xxxdone
[/skip]
You see this first.
->xxx
@xxxdone
And finally we're here.
```

### Branch blocks
Use a branch block to choose dialogue based on memory. Cases may check the same identifier or different identifiers:
```bny
[branch]
    [when:dragon=slain]
        The dragon is gone. Here is your reward!
    [when:reputation=trusted]
        I can tell you where the dragon lives.
[/branch]
What else would you like to know?
```
Each `[when:identifier=value]` compares the current memory value of `identifier` with the literal string `value`. The **first matching case** runs, even if later conditions also match. After that case, dialogue continues after `[/branch]` unless it uses a goto. If none match, it goes straight to the dialogue after the block. For example, with `dragon=alive` and `reputation=trusted`, the second case runs.

A branch needs at least one `when` case. Case bodies can be empty and can contain other statements, including nested branches, choices, and gotos. Spaces around the identifier and value are trimmed; use the usual text escapes for literal brackets in a value. The value is compared literally: `$variables` are not expanded in conditions. Set memory before the branch runs with `:SET dragon=slain` or `vm.memory.set('dragon', 'slain')`.

### Signals
Use `:SIGNAL identifier` on its own line to notify listeners when execution reaches it. Add `:value` to include a string value:
```bny
Here is the key to the castle!
:SIGNAL keygiven
:SIGNAL quest:complete
```
Handle signals through the emission handler. Signal emissions contain `{ kind: 'signal', identifier, value }`, where `value` is `undefined` when omitted. Signals continue execution immediately. Their values are literal strings; `$variables` are not expanded in them.
```ts
const vm = createVM(build(source), {
    handler: emission => {
        if (emission.kind === 'signal') {
            console.log(emission.identifier, emission.value);
        }
    }
});
vm.start();
```
Inline tags such as `<face:thinking>` and `<signal:keygiven>` are currently ordinary dialogue text; they do not create built-in face changes or signals.

### Yields
Use `:YIELD identifier` to pause execution and hand control to the consumer. Like `:SIGNAL`, it accepts an optional `:value` string:
```bny
:YIELD rattle_door: front
The door won't open {
    ?: Knock
        Anyone home?
    ?: Use key
        The lock clicks open.
}
```
The handler receives `{ kind: 'yield', identifier, value }`, and the execution call returns `'yield'`. The value is `undefined` when omitted and is a literal string otherwise. The consumer can perform an action, wait for an animation, or update `vm.memory` before calling `vm.resume()`. A yield pauses execution; a signal continues immediately.

For example, handling the leading yield in the script above:
```ts
let action: { identifier: string; value: string | undefined } | undefined;
const vm = createVM(build(source), {
    handler: emission => {
        if (emission.kind === 'yield') action = emission;
        else console.log(emission); // Render dialogue and options in your application.
    }
});
let wait = vm.start();
if (wait === 'yield' && action) {
    await performAction(action.identifier, action.value); // Your application's action handler.
    wait = vm.resume();
}
```
Dialogue is emitted immediately. For `A`, `B`, `:YIELD action`, starting emits A and returns `'next'`; calling `vm.next()` emits B followed by the yield and returns `'yield'`. Resuming preserves the line pause: if another dialogue line follows, the VM returns `'next'` before emitting it. A leading yield allows the first dialogue line to be emitted when resumed.

To delay choices until an action finishes, put a yield between their prompt and a bare choice block:
```bny
Choose your route.
:YIELD reveal_map
{
    ?: Forest
        Into the trees.
    ?: Mountain
        Up the trail.
}
```
The VM emits "Choose your route." before the yield. Resuming emits the options without repeating the prompt. Choice conditions are evaluated after the action resumes.

The browser demo displays dialogue, signals, and yields in emission order. It offers Continue for `'next'` and `'yield'` pauses, and buttons for visible options when waiting for `'select'`. A game integration can resume a yield after its own action completes.

### Runtime Variables
The same string memory is used by branch and option conditions, and by `$variables` in dialogue and `:SET` values:
```bny
:SET name=Rabbit
Hello, $name.
:SET dragon=slain
:SET greeting=Hello $name
$greeting!
[branch]
    [when:dragon=slain]
        The dragon is gone!
[/branch]
```
Variable names start with a letter or underscore and can then contain letters, digits, or underscores. The same rule applies to identifiers in `:SET`, `:SIGNAL`, `:YIELD`, and `[when:...]`. A missing `$variable` is replaced with an empty string. `:SET identifier=value` stores the interpolated string when execution reaches it; `:SET identifier` deletes the value. Interpolation is a single pass: a `$` in a stored value is not expanded again when that value is used in dialogue. There is no source-level escape for a literal `$name`.

You can also supply initial values and change them while the VM is running:
```ts
const vm = createVM(build(source), {
    memory: { name: 'Rabbit' },
    handler: emission => console.log(emission)
});
vm.memory.set('dragon', 'slain');
const name = vm.memory.get('name');
vm.memory.delete('dragon');
```
Conditions read memory when the VM reaches the block, so changes made before then affect the selected case. The VM also emits `{ kind: 'end' }` when the script finishes. `start()`, `next()`, `choose(index)`, and `resume()` return a wait state: `'next'` means call `next()` for the following dialogue line, `'select'` means choose from the emitted visible options, `'yield'` means call `resume()` after handling the yield, and `'end'` means execution has finished. Call only the method appropriate for the current wait state.
