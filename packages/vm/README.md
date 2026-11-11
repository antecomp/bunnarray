Runs BunNarray dialogues compiled with [`@bunnarray/compiler`](https://www.npmjs.com/package/@bunnarray/compiler?activeTab=readme) or imported through [`@bunnarray/vite`](https://www.npmjs.com/package/@bunnarray/vite?activeTab=readme).
See the project at https://github.com/antecomp/bunnarray/.

```shell
npm install @bunnarray/compiler
```

The core export from this package is `createVM`, which configures a BunNarraY interpreter to run compiled dialogue programs.

`createVM` has the following shape:
```ts
createVM(
    program: BnyProgram,
    options: {
        onEmission: BnyEmissionHandler,
        onPause: BnyPauseHandler,
        memory?: BnyMemorySnapshot
    }
)
```

In short: 
- `program` is a compiled BunNarraY program ([see project overview](https://github.com/antecomp/bunnarray/)).
- `onEmission` is a callback for whenever the VM makes an "emission" as it runs through the dialogue, such as a line of text or a signal. This is what you'd wire up to your dialogue display code. 
- `onPause` is a callback for whenever the VM "pauses" and needs user input, such as advancing through lines of text or selecting options. This is what you'd wire up to your player input code.
- The optional `memory` snapshot is a record of variables you'd like to set before starting the dialogue, such as pulling in game state.

`createVM` then returns a simple `vm` interface: `memory` and `start`.
- `memory` lets you interface with the VM memory directly (read & update).
- `start` starts the VM running the dialogue. After that, continuing through it is the responsibility of the `onPause` handler. More on that below.

## Emissions & onEmission

Emissions are fire-and-forget events from the VM as it runs through the dialogue. They include:

| `kind`   | Data                                       | Meaning                                                       |
| -------- | ------------------------------------------ | ------------------------------------------------------------- |
| `say`    | `text`, `speaker: string \| null`          | Encountered a dialogue line.                                  |
| `signal` | `identifier`, `value: string \| undefined`   | Generic non-blocking notification (`:SIGNAL`s in the language) |
| `memory` | `key`, `prev`, `value`                     | A memory entry was set or deleted. `undefined` means absent.   |

The `onEmission` (`BnyEmissionHandler`) callback has the shape `(emission: BnyEmission) => void`. Each emission is one of the three types above, identified by its `kind` property:

```ts
type BnyEmission =
    | {  kind: 'say'; text: string; speaker: string | null }
    | ({ kind: 'memory' } & BnyMemoryUpdate) // (more on BnyMemoryUpdates in the memory section below)
    | {  kind: 'signal'; identifier: string; value: string | undefined };

type BnyEmissionHandler = (emission: BnyEmission) => void;
```

For example, you could link this up to a JavaScript game like this:

```ts
const onEmission: BnyEmissionHandler = (emission) => {
    switch(emission.kind) {
        case 'say':
            dialogueTextBox.textContent = `${emission.speaker ?? '(NARRATOR)'}: ${emission.text}`;
            break;
        case 'memory':
            // update persisted game memory here, if desired.
            break;
        case 'signal': 
            // This can update game state, trigger animations, etc.
            handleSignal(emission.identifier, emission.value);
            break;
    }
}
```

