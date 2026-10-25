Forked from an earlier project for a game jam [here](https://github.com/antecomp/pixicrystal/tree/main)
Wanted to continue development of this dialogue system but remove the overfitting to the game,
I hope to make something more generic that can be used for my (and others) own projects!

-------------------------------------------------------

# The BunNarraY Dialogue Language 𑣲₍ ᐢ. .ᐢ₎
Because I am utterly insane I took this as an opportunity to create my own custom dialogue language parser using [chevrotain](https://chevrotain.io/docs/).

## Runtime Usage
`build(source)` compiles `.bny` text into a versioned instruction program. Pass that program to `createVM`, then call `vm.init()` to start. The VM returns steps with `kind: 'say'`, `'choice'`, `'yield'`, or `'end'`. Call `resume()` on a dialogue line or yielded signal to continue, or `resume(index)` on a choice with the selected zero-based option index. An end result has no resume callback. Initialization and each resume callback can only be called once; repeated calls throw. Game state lives in `vm.memory` and can be supplied when the VM is created:
```ts
const vm = createVM(build(source), { memory: { dragon: 'slain' } });
const firstStep = vm.init();
```

## Writing Dialogue
The syntax is pretty simple...

### Basic Text
Each normal line of text becomes a separate dialogue message when the VM runs.
Square brackets (`[` and `]`) and curly braces (`{` and `}`) are reserved for language syntax. To include them literally in text, use `&lbrack;`, `&rbrack;`, `&lbrace;`, and `&rbrace;`, respectively. These escapes also work in option text and other text fields. Use `&amp;` to write a literal escape sequence, such as `&amp;lbrace;` for the text `&lbrace;`.
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
The runtime presentation includes the speaker name, or `null` for the narrator.

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
Empty names, such as in `:ALTERNATE Alice;;Bob`, are invalid.

### Comments
I only have line comments right now becuase they are easier 
to parse lol. Use `#` at the start of a line to comment it out.
```
# At this point in the story, she probably hates you.
I hate you!
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
Subscribe through the VM. The callback receives `{ identifier, value }`, where `value` is `undefined` for a signal without a value:
```ts
const unsubscribe = vm.signals.subscribe(({ identifier, value }) => {
    console.log(identifier, value);
});
// Call unsubscribe() when the listener is no longer needed.
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
The VM returns `{ kind: 'yield', presentation, identifier, value, resume }`. The consumer displays any included presentation, then can perform an action, wait for an animation, or update `vm.memory` before calling `resume()` to continue after the directive. The value is `undefined` when omitted. The presentation is `null` if there is no pending dialogue. A yielded signal does not notify `vm.signals` subscribers. `:SIGNAL` notifies subscribers and continues execution immediately; `:YIELD` waits for the consumer to resume.

For example, handling the first step of the script above:
```ts
const vm = createVM(build(source));
const step = vm.init();
if (step.kind === 'yield') {
    if (step.presentation !== null) {
        showDialogue(step.presentation); // Your application's dialogue renderer.
    }
    await performAction(step.identifier, step.value); // Your application's action handler.
    const nextStep = step.resume();
    // Pass nextStep to your dialogue renderer.
}
```
Dialogue text is queued so it can be paired with following choices. A yield consumes the pending text and includes it in its own presentation, preserving the visible order of text and actions. For `A`, `B`, `:YIELD action`, the consumer presents A, then receives a yield with B. Resuming continues after the action without repeating B. In the example above, there is no pending text, so `rattle_door` completes before the prompt and choices are presented.

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
The yield includes "Choose your route." as its presentation. Resuming returns the choices with `presentation: null`, so the prompt is shown only once. Choice conditions are evaluated after the action resumes.

The browser demo displays any presentation before the yielded identifier and value, with a Continue button. Clicking it resumes the VM; a game integration can resume after its own action completes instead.

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
const vm = createVM(build(source), { memory: { name: 'Rabbit' } });
vm.memory.set('dragon', 'slain');
const name = vm.memory.get('name');
vm.memory.delete('dragon');
```
Conditions read memory when the VM reaches the block, so changes made before then affect the selected case.

### Compiled program
`build(source)` returns a `Program` with a `version` and a linear `instructions` array. The VM executes these instructions; it does not require a graph of dialogue nodes. The browser demo in `src/runner.ts` shows one way to render dialogue, choices, and yielding signals.

### Why is it called BunNarraY?
* Bun Narray-tives. Or Bun Array of text or something idk.
* bnuy :)
* .bny is not a commonly used file-extension.

-------------------------------------------------------

### TODO
* Make the handler callbacks generic? Or some sort of system to make integration into any dialogue navigation implementation simple.
* May be overfit to DG, but potentially add CAR support? (Or just make this responsibility of final parse from raw dialogue to that specific format)
* Make directives generic, leave it up to the personal implementation of dialogue node to handle them.
    * Ergo, make a good shape for some raw dialogue node that just provides all the directives. Up to the implementation to convert that into a runtime model.
* Move label collection to visitor to remove redundant second pass through dialogue tree?
* MORE TESTS. THERE ARE BUGS I CAN FEEL THEM CRAWLING AROUND AT NIGHT. I KNOW THEY ARE THERE.
* Another DG specific thing, but I think I can make it general / up to implementor: nested questions **not** to create brand new (duplicate) node, but instead some sort of flagged "empty"
    * The current clone implementation will cause duplicate messages to be sent in many implementations (including DG), so we should change it to not assume use-case.

## VS Code Syntax Highlighting

A minimal VS Code language extension for `.bny` files lives in [tools/vscode-bny](./tools/vscode-bny).

It currently highlights:

- comments
- labels like `@start`
- gotos like `-> start`
- option markers like `?:`
- `[branch]` blocks and `[when:identifier=value]` cases
- choice braces
- inline tags like `<face:neu_smile>`

To try it locally, open that folder in VS Code and run an Extension Development Host with `F5`, or package/install it as a normal extension.
