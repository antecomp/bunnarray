# Crystal (Working Title)
A short custom-built visual novel created for the Agora Road "Demo Disc Jam"

Made using PixiJS, Vite & Tauri.

# BNY DIALOGUE 𑣲₍ ᐢ. .ᐢ₎
Because I am utterly insane I took this as an opportunity to create my own custom dialogue language parser using [chevrotain](https://chevrotain.io/docs/).

The syntax is pretty simple...

### Basic Text
Normal lines of text all create individual dialogue nodes in the tree. New lines make them distinct new 'messages.'
```
Hello, it has been a while,
how has life been treating you?
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

### Comments
I only have line comments right now becuase they are easier 
to parse lol. Use `#` at the start of a line to comment it out.
```
# At this point in the story, she probably hates you.
I hate you!
```

### Directives
Within a line of dialogue text (and normal text only) you 
can define directives for additional behavior. Right now 
there is only one directive but I plan on adding more.
Directives take the format of `<directive:value>`. 

The current directive this system support is one called `face`, it is used to indicate the expression sprite to use when displaying this dialogues text. If this directive is not supplied, we just assume the most recent face at runtime.

For example...
```
But what I really think is... <face:thinking>
That I am angry! <face:anger>
```
> How you handle these faces is up to implementation, of course, but the basic idea is that the generated dialogue "node" (described below) has a face attribute you can read.

### DialogueNode (actual runtime type)
If making your own "runner" for the dialogue, know that this parser converts everything into a graph of DialogueNodes. DialogueNodes take the shape:
```typescript
export type DialogueNode = {
    text: string;
    // Otherwise inherit from parent.
    face?: string;
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

### Why is it called BNY?
* bnuy :)
* .bny is not a commonly used file-extension.

-------------------------------------------------------

### TODO
* Side-Effect Directives. 
* Maybe some runtime directive to swap out text for variables?
* Conditional Branches based on runtime state (use SE directives to update state too, be careful about traceability!)