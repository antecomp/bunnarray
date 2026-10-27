# Writing Dialogue
The syntax is pretty simple...

### Basic Text
Each normal line of text becomes a separate dialogue message when the VM runs.
Square brackets (`[` and `]`) and curly braces (`{` and `}`) are reserved for language syntax. To include them literally in text, use `&lbrack;`, `&rbrack;`, `&lbrace;`, and `&rbrace;`, respectively. These escapes also work in option text and other text fields. Use `&hash;` for a literal `#` and `&amp;` to write a literal escape sequence, such as `&amp;lbrace;` for the text `&lbrace;`.
```
Hello, it has been a while,
how has life been treating you?
The answer is &lbrace;maybe&rbrace;.
```

### Speakers
Use `:SPEAKER name` on its own line to set the speaker for the following dialogue lines. The name carries forward until another `:SPEAKER` line changes it. Use `:SPEAKER` by itself to return to the narrator.
```
:SPEAKER Alice
Hello!
Still Alice speaking.
:SPEAKER
The story continues.
```
Each `say` emission includes the speaker name, or `null` for the narrator.

Use `:ALTERNATE` with semicolon-separated names to rotate speakers on each dialogue line. Names may contain spaces. A bare `:ALTERNATE` stops the rotation and leaves the last speaker in place. `:SPEAKER` also stops the rotation and sets a new speaker.
```
:ALTERNATE Alice; Bob Smith
Hello!
Hi!
Hello again!
:ALTERNATE
Still Alice speaking.
```
The first three lines are spoken by Alice, Bob Smith, and Alice, respectively.
An empty name, such as in `:ALTERNATE Alice;;Bob`, selects the narrator for that turn.

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
Within that `...` can be essentially anything: more normal lines of text, followup nested options, and any of the other syntax described below. Option text is a selectable response; it does not become a new prompt.

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

### Labels and Gotos
A line of text (or prompt) can be 'labeled' if it proceeded by a line of the format `@label`. For example:
```
@weather
Lovely weather we are having!

@howareyou
How are you? {
    ?: ...
}
```
Then, you can mark that you want to jump (GOTO) these labeled nodes anywhere else in the script with a line of the format `->label`. For example:
```
Blah blah blah
Say, I never asked you how you were...
->howareyou
```
And now after "Say, I never asked you how you were..." the 
dialogue will jump to that "How are you" question from early.
> GOTOs can refer to labels before and after themselves, so 
> you can easily use it to skip blocks of text too!

### Fallbacks
These gotos are often used within dialogue options, such as...
```
this option branches to many places in the dialogue
where to? {
    ?: weather
        -> weather
    ?: ask me how I am
        okay fine, I will!
        -> how are you
}
```
But they are not necessary at all. In fact, if there is no 
goto at the tail of an option's sequence, it will "fall into" whatever is defined right after the question block:
```
How are you? {
    ?: good
        cool.
    ?: bad
        not cool
}
Well, anyways... the dialogue continues here...
```
"Well anyways..." will come after both "cool" and "not cool." automatically.

### Skip Blocks
Skip blocks allow you to define a sequence of dialogue that will be skipped over when running through linearly, and instead required an explicit goto to get into. It allows you to optionally preface text or perform other actions where you want to conditionally show certain chunks in a sequence. They take the form:
```
[skip:label]
...
[/skip]
```
Where `label` is the label you will use to get into this block with a goto. For example;
```
Lets test the skip block...
[skip:xxx]
    and this second
    ->xxxdone
[/skip]
You should see this first
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

A branch needs at least one `when` case. Case bodies can be empty and can contain other statements, including nested branches, choices, and gotos. Spaces around the identifier and value are trimmed; use the usual text escapes for literal brackets in a value. Set memory before the branch runs with `:SET dragon=slain` or `vm.memory.set('dragon', 'slain')`.

### Signals
Use `:SIGNAL identifier` on its own line to notify listeners when execution reaches it. Add `:value` to include a string value:
```bny
Here is the key to the castle!
:SIGNAL keygiven
:SIGNAL quest:complete
```
Handle signals through the emission handler. Signal emissions contain `{ kind: 'signal', identifier, value }`, where `value` is `undefined` when omitted. Signals continue execution immediately:
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

### Yielding Signals
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
The handler receives `{ kind: 'yield', identifier, value }`, and the execution call returns `'yield'`. The value is `undefined` when omitted. The consumer can perform an action, wait for an animation, or update `vm.memory` before calling `vm.resume()`. A yield pauses execution; a signal continues immediately.

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

The browser demo displays dialogue and yielded identifiers and values in emission order, with a Continue button at each pause. Clicking it resumes the VM; a game integration can resume after its own action completes instead.

### Runtime Variables
The same string memory is used by branch conditions and `$variables` in dialogue text:
```bny
Hello, $name.
:SET dragon=slain
[branch]
    [when:dragon=slain]
        The dragon is gone!
[/branch]
```
Variable names start with a letter or underscore and can then contain letters, digits, or underscores. A missing `$variable` is replaced with an empty string. `:SET identifier=value` stores a string; `:SET identifier` deletes it.

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
Conditions read memory when the VM reaches the block, so changes made before then affect the selected case.