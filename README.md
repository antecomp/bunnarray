# The BunNarraY Dialogue Language 𑣲₍ ᐢ. .ᐢ₎
BunNarraY is a simple dialogue scripting language built with [chevrotain](https://chevrotain.io/docs/). It is designed to integrate into your TS/JS games and experiences.

Originally created as part of a small [game jam project](https://github.com/antecomp/pixicrystal/tree/main), it has been completely redesigned for general use!

### Index
- [Language guide](doc/language.md): dialogue, choices, branches, variables, speakers, and directives.
- [Runtime guide](packages/vm/README.md): emissions, pauses, memory, and errors.
- [Compiler guide](packages/compiler/README.md) to compile source and handle diagnostics.
- [Vite plugin](packages/vite/README.md) to import `.bny` files in a Vite app.
- [VS Code extension](tools/vscode-bny/README.md): highlighting and snippets.
- [Development guide](doc/development.md): work on this repository and run the playground.


### Quick Example
For a quick feel of the language without checking documentation, see below:
```
:SPEAKER Alice
Hello! It's good to see you!
What should we do? {
    ?: Take a walk
        :SET route = the park
        The park sounds lovely.
    ?: Stay here
        :SET route = home
        Let's get comfortable.
}
We chose $route.
```
BunNarraY has many more tricks than this! But hopefully this gives some clarity on how simple it is to use! No spamming quotation marks or any other noisy syntax!

### Using it in a project

For the BunNarraY compiler, you have two options:

#### Vite Users
BunNarraY comes with a Vite 6-8 plugin that turns BunNarraY (`.bny`) imports into runtime programs at build time! Install it:
```shell
npm install @bunnarray/vite
```
And see the [Vite guide](packages/vite/README.md) for details!

### Runtime Compiler / Custom Usage
If you aren't using Vite or otherwise want to use the compiler directly, it can be installed with:
```shell
npm install @bunnarray/compiler
```
and then used by importing the `build` method:
```ts
import { build } from '@bunnarray/compiler';
const program = build(`
    Hello!
    Welcome to my house!
`);
```
> Learn more about the compiler [here](packages/compiler/README.md)!

In both of these cases, you can then also use the BunNarraY VM to run through compiled dialogue!
```shell
npm install @bunnarray/vm
```
```ts
import { createVM } from '@bunnarray/vm';
import dialogue from './example.bny';

const vm = createVM(dialogue, {
    // emissions are things like lines of text!
    // this is plugged into your display code
    onEmission: emission => console.log(emission),
    // pauses are when the VM needs input to continue
    onPause: pause => {
        // this is linked up to user input handlers!
    }
});

vm.start()
```
> See the [runtime guide](packages/vm/README.md) for the full contract.


## License

MPL-2.0. See [LICENSE](LICENSE).