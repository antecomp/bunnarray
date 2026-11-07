# Writing Dialogue

BunNarraY scripts contain dialogue lines, directives, and blocks. Blank lines and indentation are ignored; braces and brackets delimit blocks. The examples below use `.bny` source. For the JavaScript and TypeScript API, see the [compiler](../packages/compiler/README.md) and [runtime](../packages/vm/README.md) guides.

### Basic Text
Each normal line of text becomes a separate dialogue message when the VM runs.
Leading and trailing whitespace on a dialogue line is removed.
Square brackets (`[` and `]`), curly braces (`{` and `}`), and pipes (`|`) are reserved for language syntax. To include them literally in text, use `&lbrack;`, `&rbrack;`, `&lbrace;`, `&rbrace;`, and `&pipe;`, respectively. These escapes also work in option text and other text fields. Use `&hash;` for a literal `#` and `&amp;` to write a literal escape sequence, such as `&amp;lbrace;` for the text `&lbrace;`.
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

Use `|name|` as shorthand for `:SPEAKER name`. It can share a line with dialogue or appear on its own. The speaker persists for following dialogue lines, and `||` returns to the (null) narrator. Like `:SPEAKER`, the shorthand stops any active speaker rotation. Names may contain spaces and text escapes.
```bny
|Alice| Hello!
Still Alice speaking.
|Bob Smith| How are you? {
    ?: Good
        Glad to hear it.
}
|| The story continues.
```

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
An option body can contain dialogue lines, nested choices, directives, branches, and gotos. Option text is a selectable response; it is not emitted as dialogue. A choice block can be empty (`{}`), in which case execution continues after it. The newline after the opening `{` is optional; `{ ?: Yes }` is valid. The prompt is an ordinary dialogue line before the block, not part of the choice syntax. You can omit it and start with a bare `{` block. When the VM reaches a choice with visible options, it pauses for a selection; it does not issue a separate `next` pause between the preceding dialogue line and those options.

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
Selecting "Good" goes directly to the inner choices. Every `?:` still needs option text; `?: {` is not valid syntax.

Choice blocks can also follow one another, each with its own options. A bare block after a prompted block presents another choice without speaking a new prompt.

Prefix an option with `[when:identifier=value]` to show it only when that memory value matches. Use `[when:identifier]` to show it whenever that memory entry exists, including when its value is an empty string. Options without a condition are always shown:
```bny
What should we do? {
    ?: [when:has_key=yes] Open the door
        The door opens.
    ?: Leave
        We turn back.
}
```
Conditions are checked when the VM reaches the choice. Every matching option is shown in its original order. If none are available, the VM continues after the choice block without showing an empty option list; a preceding prompt is still spoken as dialogue.

Prefix an option with `[id:name]` to attach an identifier to the option returned by the VM:
```bny
Where next? {
    ?: [id:garden] Garden
        Let's go outside.
    ?: [when:has_key=yes] [id:cellar] Cellar
        The key fits.
}
```
`[id:...]` and `[when:...]` can appear in either order before the option text. IDs are optional strings; the VM does not use them to choose a branch. A `{ kind: 'select' }` pause contains an `options` array with entries such as `{ text: 'Garden', id: 'garden' }`; untagged options have `id: undefined`. Call that pause's `resume(index)` with the **zero-based index in the visible option list**. Hidden options do not occupy an index. Option text and IDs are fixed strings; `$variables` in them are not interpolated.

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
Each `[when:identifier=value]` compares the current memory value of `identifier` with the literal string `value`. A `[when:identifier]` case matches whenever that memory entry exists, including when its value is an empty string; it stops matching after `:SET identifier` or `vm.memory.delete('identifier')`. The **first matching case** runs, even if later conditions also match. After that case, dialogue continues after `[/branch]` unless it uses a goto. If none match, it goes straight to the dialogue after the block. For example, with `dragon=alive` and `reputation=trusted`, the second case runs.

A branch needs at least one `when` case. Case bodies can be empty and can contain other statements, including nested branches, choices, and gotos. Spaces around the identifier and value are trimmed; use the usual text escapes for literal brackets in a value. The value is compared literally: `$variables` are not expanded in conditions. Set memory before the branch runs with `:SET dragon=slain` or `vm.memory.set('dragon', 'slain')`.

### Signals
Use `:SIGNAL identifier` on its own line to notify listeners when execution reaches it. Add `:value` to include a string value:
```bny
Here is the key to the castle!
:SIGNAL keygiven
:SIGNAL quest:complete
```
Handle signals through `onEmission`. Signal emissions contain `{ kind: 'signal', identifier, value }`, where `value` is `undefined` when omitted. Signals continue execution immediately. Their values are literal strings; `$variables` are not expanded in them.
```ts
const vm = createVM(build(source), {
    onEmission: emission => {
        if (emission.kind === 'signal') {
            console.log(emission.identifier, emission.value);
        }
    },
    onPause: pause => {
        if (pause.kind === 'next') pause.resume();
        if (pause.kind === 'select') pause.resume(0);
        if (pause.kind === 'yield') pause.resume();
        if (pause.kind === 'error') console.error(pause.error);
    }
});
vm.start();
```

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
The VM reports a `{ kind: 'yield', identifier, value, resume }` pause through `onPause`. The value is `undefined` when omitted and is a literal string otherwise. The consumer can perform an action, wait for an animation, or update `vm.memory` before calling that pause's `resume()`. A yield pauses execution; a signal continues immediately through `onEmission`.

For example, handling the leading yield in the script above:
```ts
const vm = createVM(build(source), {
    onEmission: emission => console.log(emission),
    onPause: pause => {
        if (pause.kind === 'yield') {
            performAction(pause.identifier, pause.value).then(() => pause.resume());
        }
        // Handle next, select, end, and error pauses in your UI too.
    }
});
vm.start();
```
Here `performAction` is supplied by your application; handle promise rejection in your application. Dialogue is emitted immediately. For `A`, `B`, `:YIELD action`, starting emits A and reports a `next` pause. Calling its `resume()` emits B and reports a `yield` pause. Resuming the yield preserves the line pause: if another dialogue line follows, the VM reports `next` before emitting it. A leading yield allows the first dialogue line to be emitted when resumed.

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
The VM emits "Choose your route." before reporting the `yield` pause. Resuming it reports the options without repeating the prompt. Choice conditions are evaluated after the action resumes.

The browser playground displays dialogue, memory changes, and signals as they are emitted, and shows each yield when the VM pauses. It offers Continue for `next` and `yield` pauses, and buttons for the options in a `select` pause. A game integration can resume a yield after its own action completes.

### Runtime Variables
The same string memory is used by branch and option conditions, and by `$variables` in dialogue, speaker names, and `:SET` values. Speaker names (including `:ALTERNATE` names) are interpolated for each dialogue line using current memory:
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
    onEmission: emission => console.log(emission),
    onPause: pause => {
        if (pause.kind === 'next') pause.resume();
        if (pause.kind === 'select') pause.resume(0);
        if (pause.kind === 'yield') pause.resume();
        if (pause.kind === 'error') console.error(pause.error);
    }
});
vm.memory.set('dragon', 'slain');
const name = vm.memory.get('name');
vm.memory.delete('dragon');
```
Conditions read memory when the VM reaches the block, so changes made before then affect the selected case. Each memory set or successful deletion emits a `memory` event with `key`, `prev`, and `value`; `undefined` means the key is absent. `vm.memory.snapshot()` returns a copy of all entries. The VM reports `{ kind: 'end' }` through `onPause` when the script finishes. `start()` returns `void`, and `next`, `select`, and `yield` pauses each carry their own one-use `resume` callback. See the [runtime guide](../packages/vm/README.md) for all emission and pause types.
