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

## Pauses & onPause

Pauses are events that indicate the vm has paused execution, typically indicating it's awaiting input in order to continue. They include:

| `kind` | Data | Host action |
| --- | --- | --- |
| `next` | `resume()` | Continue to the next dialogue line. |
| `select` | `options`, `resume(index)` | Show the visible options and pass a zero-based index into that list. |
| `yield` | `identifier`, `value`, `resume()` | Complete an external action, then continue. |
| `end` | none | The program finished. |
| `error` | `error: Error` | Execution stopped after a runtime or callback error. |

Similar to `onEmission`, `onPause` (`BnyPauseHandler`) is a callback of the shape `(pause: BnyPause) => void;`. Each pause is one of the types above, identified by it's `kind` property:
```ts
type BnyPause =
    | { kind: 'next'; resume: VoidFunction }
    | { kind: 'select'; options: BnyOption[]; resume: (index: number) => void }
    | { kind: 'yield'; identifier: string; value: string | undefined; resume: VoidFunction }
    | { kind: 'end' }
    | { kind: 'error'; error: Error };
```

For the pause items that require input to continue, they include a `resume` method. Calling `resume` is what will continue the vms operation. They are designed to only be called once. 

Each pause event requires unique handling:

#### next
The vm, typically when running through the dialogue pauses *before* emitting a line of text, pausing with the `next` type. Calling `resume` here will emit that line of text and continue through the dialogue until the next pause event.

The exception to that is when an option is selected (see below), the first line of text immediately following an option selection will automatically emit without any pause beforehand.

#### select
Indicates we've hit a set of options (user dialogue choices). This event would be wired up to user input to display and select these options. 
In the case of `select`, the `resume` method requires an index of the selected option. That index corresponds to the index of the option within the options array, an invalid index will throw without crashing the vm. There will always be at least one option. Each option has `text` and optional `id`; untagged options have `id: undefined`. Option ids can be used for adding custom display logic, they have no impact on the vms handling.

> *Note: option conditions are evaluated when the VM reaches a choice, and hidden options do not occupy an index. If no option is visible, the VM skips the choice without a `select` pause.*

#### yield
Operates in a similar way to a signal emission, but with the expectation that execution should not continue until the signal is handled. This would typically be reserved for animations or other events where you want to pause dialogue until some external action is complete.  This pause has plain `resume` method, like next, for when you're ready to resume execution.

#### end
Hit the end of the dialogue. Link this up to your cleanup code.

#### error
When the vm encounters a halting runtime error. For example, the VM may signal this if it encounters an infinite loop.