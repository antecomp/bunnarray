# The BunNarraY Dialogue Language 𑣲₍ ᐢ. .ᐢ₎
BunNarraY is a simple dialogue scripting language built with [chevrotain](https://chevrotain.io/docs/). It is designed to integrate into your TS/JS games and experiences.

Originally created as part of a small [game jam project](https://github.com/antecomp/pixicrystal/tree/main), it has been completely redesigned for general use!

### Index
[Writing Dialogue](./doc/language.md)

Runtime Usage
- Holding off on writing this until the vite plugin is done.

Development
- Holding off on this until other TODOs are done.

### Quick Example
For a quick feel of the language without checking documentation, see below:
```
:SPEAKER example
Hello!
How is it going? {
    ?: Good
        That is great to hear!
    ?: Bad
        I am sorry to hear that!
        Do you want to talk about it? {
            ?: No
                Oh, okay.
        }
}
Anyways!
I would like to introduce you to my friend, John.
:SPEAKER John
Hey there, nice to meet you!
I just got back from the donut shop.
Do you want one? {
    ?: Sure.
        @givedonut
        :SET has_donut=yes
        Here you go.
    ?: No thanks.
        Are you sure? {
            ?: Actually, give me one!
                ->givedonut
            ?: Yep.
                Alright.
        }
}
Well I have to bounce!
:SPEAKER # Setting no speaker makes it null, I'd suggest pairing this with some narration box!
John runs off.
:SPEAKER example
What a character!
[branch]
    [when:has_donut=yes]
        Well man, enjoy your donut!
[/branch]
I gotta head out too! Cya!
```
BunNarraY has many more tricks than this! But hopefully this gives some clarity on how simple it is to use! No spamming quotation marks or any other noisey syntax!