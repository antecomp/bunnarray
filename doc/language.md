# Writing Dialogue
Dialogue is written in `.bny` source files. For the JavaScript and TypeScript API, see the [compiler](../packages/compiler/README.md) and [runtime](../packages/vm/README.md) guides.

### General Notes
- Indentation and blank lines are ignored.
- Line comments can be added with `#`. A comment can follow a statement or appear on a line by itself.
- Certain characters are reserved for language syntax. To place them in text, use their respective escape sequences:
    - Square brackets (`[` and `]`) - `&lbrack;`, `&rbrack;`
    - Curly braces (`{` and `}`) - `&lbrace;`, `&rbrace;`
    - Pipes (`|`) - `&pipe;`
    - Hash (`#`) - `&hash;`
    - Use `&amp;` for an ampersand that would otherwise start a recognized escape sequence. For example, `&amp;hash;` produces the literal text `&hash;`. Other ampersands can appear as they are.

## Syntax

### Basic Text
Every plain line of text becomes a single dialogue message.
```bny
Hey dude, great job!
You're amazing!
Seriously, you are &hash;1!
```

### Speakers
Use `:SPEAKER name` on its own line to set the speaker for the following dialogue lines. The name carries forward until another speaker directive changes it. `:SPEAKER` by itself without a name will unset the speaker (e.g., for a narrator mode).
```bny
:SPEAKER Hazel
Hello!
It's me, Hazel!
:SPEAKER
Hazel hops away.
```

Use `|name|` as a shorthand for `:SPEAKER name`. It can be placed on the same line as the spoken dialogue, or appear on its own. `||` acts the same as an empty `:SPEAKER` line and unsets the speaker.
```bny
|Hazel| Hello!
        It's me, Hazel!
|| Hazel hops away.
```

Use `:ALTERNATE` with semicolon-separated names to rotate speakers on each subsequent dialogue line. Names may contain spaces. A bare `:ALTERNATE` stops the rotations and leaves the last speaker in place. `:SPEAKER` (including the shorthand) also stops the rotation and sets a new speaker. Only dialogue lines advance the rotation.
```bny
:ALTERNATE Hazel; Captian Holly
Hello!          # Hazel
Hi!             # Captain Holly
Hello again!    # Hazel
:ALTERNATE
Still Hazel speaking.
```
> An empty name, such as in `:ALTERNATE Hazel;;Fiver`, selects the blank speaker (narrator) for that turn.

### Options (Player Choices)
Options (branching dialogue based on player selection) are defined with curly braces. A `?:` followed by some text defines an individual option. Everything below it until the next `?:` or the closing curly brace is the option body. That option body will run if that option is selected.
```bny
Some dialogue {
    ?: option text
        ...
    ?: another option
        ...
}
```
> The newline after the opening `{` is optional; `{ ?: Yes }` is valid.

The option body can contain any other valid BunNarraY logic, including text, nested options, or other logic. For example, you can chain options together:
```bny
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
You can also chain options together directly without any text in between:
```bny
How are you? {
    ?: Good,
        {
            ?: really good.
                Wonderful!
            ?: mostly.
                Glad to hear it.
        }
    ?: Bad
        Sorry to hear that.
}
```
> Every `?:` still needs option text; `?: {` is not valid syntax.

Place `[id:name]` after `?:` and before the option text to attach an ID to the option. This can be used if you want to track your options or have special display logic for them in your implementation.
```bny
{
    ?: [id:leave] Leave
        We turn back.
}
```

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

### Skip Blocks
Linear execution jumps over a skip block. Jump to its label to run its contents:
```bny
[skip:label]
    Optional dialogue
[/skip]
```
This is a more readable equivalent to doing something like this:
```
->skip
@show
    Optional dialogue
@skip
...
```

### Runtime Variables
Runtime variables hold text values that can be used in dialogue and conditions. A variable can be set or unset.

A runtime variable can be defined with `:SET`. A variable (`identifier`) can be set to a single line of text with `:SET identifier=value`. Leading and trailing whitespace is trimmed; spaces within the value are kept. Reserved characters use the escape sequences listed above. The value of `identifier` can be cleared by a plain `:SET identifier`. Variables can be placed into text with `$identifier`.
```bny
What do you want to drink? {
    ?: Coffee
        :SET drink = coffee
    ?: Tea
        :SET drink = tea
}
Here is your $drink!
```
Variable names start with a letter or underscore and then can contain letters, digits, or underscores (but no whitespace or special characters). A missing `$identifier` is replaced with an empty string in dialogue and speaker names. In `:SET` values, any undefined reference deletes the destination variable; for example, `:SET x=$missing` deletes `x` when `missing` is unset. In condition values, a missing reference makes the expanded value undefined; it matches an unset variable.

### Branch Blocks / "When" Statements
Branch blocks can be used to automatically divert dialogue based on memory. Each block contains a series of `when` statements. Each `[when:identifier=value]` compares the current memory value of `identifier` with `value` after variable expansion. A `[when:identifier]` case matches whenever that variable is set to anything.

In a branch block, the **first matching case** runs, even if later conditions also match.
```bny
[branch]
    [when:dragon=slain]
        The dragon is gone. Here is your reward!
    [when:reputation=trusted]
        I can tell you where the dragon lives.
[/branch]
```
A branch needs at least one `when` case. Case bodies can be empty and can contain other statements, including nested branches, choices, and gotos.

When statements can also be attached to options. Prefix an option with a when statement to only show that option when the condition passes.
```bny
What should we do? {
    ?: [when:has_key=yes] Open the door
        The door opens.
    ?: Leave
        We turn back.
}
```
Conditions are checked when execution reaches the choice. Every matching option is shown in its original order. If none are available, execution continues after the choice block without showing an empty option list (see next section).

### "Fallbacks" and "Fall-throughs"
Options, branches, and skip blocks continue with the statements following them after their selected or entered body has completed. A goto within the body can divert execution elsewhere.
For example:
```bny
{
    ?: Option A
        A
    ?: Option B
        B
}
C
```
In this example, regardless of what you pick (A or B), C will print afterwards.

As another example:
```bny
[branch]
    [when:x=something]
        A
    [when:y=something]
        B
[/branch]
C
```
After either A or B, or neither, we will hit C.

If no branch case matches, execution continues after the branch block. The same applies to choices: when all options have a when condition, and all fail, we skip the choice entirely and proceed to the next line. For example:
```bny
X
{
    ?: [when:x=never] Option A
        A
    ?: [when:y=never] Option B
        B
}
Y
```
If neither `x` nor `y` is set to `never`, this will work effectively like:
```bny
X
Y
```

### Signals
Use `:SIGNAL identifier` on its own line to emit a notification when execution passes it. This can be used to trigger in-game side effects (e.g., updating game state or playing sound effects). Add `:value` to include a specific string value in tandem with the signal identifier.
```bny
Here is the key to the castle!
:SIGNAL keygiven
:SIGNAL quest:complete
```
> Signal handling is up to the VM implementation. In the [BunNarraY VM](../packages/vm/README.md), these are captured by the `onEmission` callback.

### Yields
Yielding works identically to signals, with the intent of pausing execution to hand control to the consumer. This can be used to trigger animations or other events that should pause dialogue until they've completed.
```bny
:YIELD rattle_door:front
The door won't open
```
> Yield handling is up to the VM implementation. In the [BunNarraY VM](../packages/vm/README.md), these are handled by the `onPause` callback.

## Example
**Below is a full-fledged usage example.**

```bny
:SPEAKER server
What would you like to drink? {
    ?: Coffee
        :SET drink = coffee
    ?: Tea
        :SET drink = tea
}

What would you like in it? {
    ?: Sugar
        :SET addition = sugar
    ?: Milk
        :SET addition = milk
    ?: [when:drink=coffee] Cream      # I refuse to offer tea with cream.
        :SET addition = cream
    ?: Nothing, thanks
        :SET addition               # Clear any addition left from an earlier order.
}

[branch]
    [when:addition]
        Here is your $drink with $addition!
    [when:drink]
        Here is your $drink, just as it is!
[/branch]
:SIGNAL drink_served
:YIELD sip:cup                      # Let the consumer finish the sipping animation.

:SPEAKER   # narrator
Another man walks into the café and sits beside you.

|Man| Hello there.
[branch]
    [when:drink=tea]
        What kind of tea did you get? {
            ?: Black
                A classic. I like mine strong, too.
            ?: Green
                Good choice. I always let that one cool a little.
            ?: White
                They keep the good stuff behind the counter!
        }
    [when:drink=coffee]
        Ew coffee.
        -> coffee_debate
[/branch]

[skip:coffee_debate]
    :ALTERNATE server; Man
    Be nice. Some of us like coffee.
    All right, all right. It does smell good.
    :ALTERNATE                         # The Man keeps speaking after rotation stops.
    Maybe I'll try a cup next time.
[/skip]

|server| Anything else? {
    ?: [id:story] Why is this called the &lbrace;Curly Cup&rbrace; café?
        ->cafe_story
    ?: [id:bill] Just the bill, please
        # An empty option body continues after the choice.
}

#identifiers can't start with a number, so this still works cleanly
|server| Your total is on receipt $12.  
{
    ?: [when:addition=cream] Was the cream extra?
        No, it's included.
}
# Without cream, the choice above has no available options and is skipped.
->goodbye

[skip:cafe_story]                   # Only entered when the player asks for the story.
    |server| Our first sign painter really loved curly braces.
    |Man| And now the menu looks like a programming language.
    |server| That story is on the house. So is your drink today.
[/skip]

@goodbye
|server| Come back soon!
|| You step outside as the café bell rings.
```
