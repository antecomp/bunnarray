# Crystal (Working Title)
A short custom-built visual novel created for the Agora Road "Demo Disc Jam"

Made using PixiJS, Vite & Tauri.

# The BunNarraY Dialogue Language 𑣲₍ ᐢ. .ᐢ₎
Because I am utterly insane I took this as an opportunity to create my own custom dialogue language parser using [chevrotain](https://chevrotain.io/docs/).

## Runtime Usage
(TODO, still working on the runner API)

## Writing Dialogue
The syntax is pretty simple...

### Basic Text
Normal lines of text all create individual dialogue nodes in the tree. New lines make them distinct new 'messages.'
```
Hello, it has been a while,
how has life been treating you?
```

### Comments
I only have line comments right now becuase they are easier 
to parse lol. Use `#` at the start of a line to comment it out.
```
# At this point in the story, she probably hates you.
I hate you!
```

### Options (Branches)
Options (branching dialogue based on player responses) are defined with a prompt text and curly braces like this;
```
prompt {
    ?: option text
        ...
    ?: another option
        ...
}
```
within that `...` can be essentially anything, more normal lines of text, followup nested options, and any of the other syntax described below.

> As a bonus trick, you can actually create nested options without any additional prompt like this;
> ```
> prompt {
>    ?: {
>        ?: Inner Option
>            ...
>        ?: Another Inner Option
>    }
>    ...
>}
>```
> This nested option with no text provided will inherit the prompt text from the parent and use that instead.

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
[block:label]
...
[/block]
```
Where `label` is the label you will use to get into this block with a goto. For example;
```
Lets test the skip block...
[block:xxx]
    and this second
    ->xxxdone
[/block]
You should see this first
->xxx
@xxxdone
And finally we're here.
```

### Match blocks
Match blocks allow dialogue to automatically branch based on game state. Match block work by running a function by name, then, based on the (string) return of that function, it chooses where to navigate to. It uses the following syntax:
```
[match:on]
    =returncase
        <sequence>
    =anothercase
        <sequence>
[/match]
fallback
```
Where `on` is the name of the function that we will run and match the result of, and each case after an `=` is a potential return string of that function.
For example...
```
Well, that depends on if the dragon is slain...
[match:dragon]
    =slain
        What? The dragon is slain? That is fantastic!
        Here is all of my money!!!
    =notslain
        The dragon is still alive and I live in fear.
        Please slay the dragon and come back later
[/match]
# This goodbye will always run after the match (unless their sequence has a goto)
Goodbye!
```
Matches can also be nested or chained. A nested match allows you to enforce multiple conditions passing, and chains allow you to run matches in sequence, akin to a fallback.
```
[match:conditionOne]
    =a
        [match:nestedCondition]
            ...
        [/match]
[/match]
[match:conditionTwo]
    =noodles
        Yum!
[/match]
```

NOTE: Currently, matches cannot function as fallbacks for options. I might patch that in later.

Actually configuring these checks the matches can run is done by supplying the dialogueRunner with `matchFuncs`:
```ts
type MatchFuncs = Record<string, () => string>
const matches = {
    dragon: () => dragon.isSlain ? 'slain' : 'notslain';
}
```

### Directives
Within a line of dialogue text (and normal text only) you 
can define directives for additional behavior.
Directives take the format of `<directive:value>`. 
> Directives heavily rely on the specific shape and implementation of the DialogueNode type and its runner.

#### Face
One directive is called `face`, it is used to indicate the expression sprite to use when displaying this dialogues text. If this directive is not supplied, we just assume the most recent face at runtime.

For example...
```
But what I really think is... <face:thinking>
That I am angry! <face:anger>
```
> How you handle these faces is up to implementation, of course, but the basic idea is that the generated dialogue "node" (described below) has a face attribute you can read.

#### Signals
Another directive is called `signal`, it is used to have dialogue nodes "emit" a named signal when they are navigated into. These signals can be listened to for running side-effects and other events that correspond to reaching points in the dialogue.

For example...
```
Here is the key to the castle! <signal:keygiven>
```

Then the runtime user of the dialogue (through use of the `dialogueRunner`) can then "listen" to these signals;
```typescript
const runner = createDialogueRunner(...);
runner.addSignalListener('keygiven', () => Inventory.addItem(key));
```
The runner also has a `removeSignalListener` method, which can be used to create one-off reactions like this;
```typescript
runner.addSignalListener('something', function action() {
    // do something...
    runner.removeSignalListener('something', action);
})
```

### Runtime Variables
For pieces of text that is only known at (and could be changed during) runtime, you can also use variable names in dialogue lines:
```
Hello, $name.
```
These variable names always take the shape `$var`, they can only be basic alphanumeric characters directly after a dollar sign. This means that you use punctuation or other characters naturally without weird whitespace issues (like the `$name.` example above).

You can set and read these variables at runtime using two methods, `setVar` and `readVar`, in the dialogue runner API;
```typescript
const runner = createDialogueRunner(root, {responseText, optionsOverlay, face});
const name = "Rabbit";
runner.setVar('name', name);
// Now "Hello, $name" will read out "Hello, Rabbit."
```

Also, if some stuff is known immediately, an initial record of some variables can be passed to `createDialogueRunner`:
```typescript
const runner = createDialogueRunner(root, {responseText, optionsOverlay, face}, {name: "Rabbit"});
runner.setVar('name', name);
// Works the same, now "Hello, $name" will read out "Hello, Rabbit."
```

> Note: Variables (currently) cannot be used for option text, only normal lines of dialogue.

> Actually setting and working with these variables is the responsibility of the dialogue runner and not the parsing algorithm, this is to keep things slightly more implementation agnostic and not have any state creep into the compiler.


### DialogueNode (actual runtime type)
If making your own "runner" for the dialogue, know that this parser converts everything into a graph of DialogueNodes. DialogueNodes take the shape:
```typescript
export type DialogueNode = {
    text: string;
    // Optional, will inherit from parent (i.e be unchanged) if undefined.
    face: string | undefined;
    // Signal response handled by runner.
    signals: string[] | undefined
} & ({
    next?: DialogueNode;
} | {
    options: DialogueOption[];
});

export type DialogueOption = {
    text: string;
    next: DialogueNode;
}
```
The compile function returns the DialogueNode at the "start" of this graph corresponding to the first line of text in the dialogue script.

### Why is it called BunNarraY?
* Bun Narray-tives. Or Bun Array of text or something idk.
* bnuy :)
* .bny is not a commonly used file-extension.

-------------------------------------------------------

### TODO
* Allow options to chain into matches as a "fallback"
* Extensive general testing (should have started with this but game jams call for me not to waste a few hours writing tests)
* After the game jam, maybe a "set" directive to have some default dialogue-owned stuff for matches without needing to set up a backend.
* After the game jam, to make this general, add a "speaker" property to.
    * I think a `speaker: text` syntax for lines would work well here! Keep a similar inherit behavior to faces.

## VS Code Syntax Highlighting

A minimal VS Code language extension for `.bny` files lives in [tools/vscode-bny](./tools/vscode-bny).

It currently highlights:

- comments
- labels like `@start`
- gotos like `-> start`
- option markers like `?:`
- block braces
- directives like `<face:neu_smile>`

To try it locally, open that folder in VS Code and run an Extension Development Host with `F5`, or package/install it as a normal extension.
