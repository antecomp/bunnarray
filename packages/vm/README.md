Runs BunNarray dialogues compiled with [`@bunnarray/compiler`](https://www.npmjs.com/package/@bunnarray/compiler?activeTab=readme) or imported through [`@bunnarray/vite`](https://www.npmjs.com/package/@bunnarray/vite?activeTab=readme).
See the project at https://github.com/antecomp/bunnarray/.

```shell
npm install @bunnarray/vm
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

### For example,
you could link this up to a JavaScript game like this:

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

Pauses tell you when the VM has stopped running and what it needs before it can continue. They include:

| `kind` | Data | Host action |
| --- | --- | --- |
| `next` | `resume()` | Continue to the next dialogue line. |
| `select` | `options`, `resume(index)` | Show the visible options and pass a zero-based index into that list. |
| `yield` | `identifier`, `value`, `resume()` | Complete an external action, then continue. |
| `end` | none | The program finished. |
| `error` | `error: Error` | Execution stopped after a runtime or callback error. |

Like `onEmission`, `onPause` (`BnyPauseHandler`) is a callback with the shape `(pause: BnyPause) => void`. Each pause is one of the types above, identified by its `kind` property:

```ts
type BnyPause =
    | { kind: 'next'; resume: VoidFunction }
    | { kind: 'select'; options: BnyOption[]; resume: (index: number) => void }
    | { kind: 'yield'; identifier: string; value: string | undefined; resume: VoidFunction }
    | { kind: 'end' }
    | { kind: 'error'; error: Error };

type BnyPauseHandler = (pause: BnyPause) => void;
```

Pauses that need input to continue include a `resume` method. Call it when you're ready for the VM to continue; each `resume` method can only be called once.

Each kind of pause needs different handling:

#### next

The VM usually pauses *before* emitting a line of text. Call `resume()` when the player is ready to advance; the VM will emit that line and continue until the next pause. The first line after an option selection is an exception: it emits immediately, without a `next` pause.

#### select

The VM has reached a set of dialogue choices. Show `options` to the player, then call `resume(index)` with the zero-based index of the option they choose. The index refers to the visible `options` array; passing an invalid index throws an error but does not halt the VM.

Each option has `text` and an optional `id`. Untagged options have `id: undefined`. You can use IDs for custom display logic, but they do not affect how the VM handles a choice.

Option conditions are evaluated when the VM reaches the choice. Hidden options are left out of the array, so they do not take up an index. A `select` pause always has at least one option; if none are visible, the VM skips the choice without pausing.

#### yield

A `yield` is similar to a signal emission, but the VM waits for you to handle it before continuing. Use `identifier` and `value` to decide what to do, such as playing an animation, then call `resume()` when that action is complete. Like `next`, it takes no argument.

#### end

The dialogue has ended. Link this up to your cleanup code.

#### error

The VM has stopped because of a runtime or callback error. For example, this can happen if it encounters an infinite loop.

### For example,
you could link this up to a JavaScript game like this:

```ts
const onPause: BnyPauseHandler = (pause) => {
    switch (pause.kind) {
        case 'next':
            continueButton.disabled = false;
            continueButton.onclick = () => {
                continueButton.disabled = true;
                pause.resume();
            };
            break;
        case 'select':
            showOptions(pause.options, (index) => pause.resume(index));
            break;
        case 'yield':
            handleAction(pause.identifier, pause.value, () => pause.resume());
            break;
        case 'end':
            cleanupDialogue();
            break;
        case 'error':
            showDialogueError(pause.error);
            break;
    }
};
```

## Memory

`vm.memory` lets you read and update the VM's memory:

- `get(key)`: Returns the value for a key, or `undefined` if the key is absent.
- `has(key)`: Returns whether a key is present.
- `set(key, value)`: Sets a key to a string value.
- `delete(key)`: Removes a key and returns whether it was present.
- `snapshot()`: Returns the current memory as a record of keys and values.

Memory values are strings. You can change them while the VM is paused, including before resuming a yield or choice. Conditions use the current values when the VM reaches them.

Memory changes from BunNarraY (such as `:SET`) or from `set` and `delete` also produce a memory emission with a `BnyMemoryUpdate`:

```ts
type BnyMemoryUpdate = {
    key: string;
    prev: string | undefined;
    value: string | undefined;
};
```

You can use these emissions to react to memory changes, such as updating game state or persisting values elsewhere.

## Full example

This compiles a short dialogue and runs it in the VM. Install `@bunnarray/compiler` alongside the VM for this example. The UI functions stand in for your game's dialogue display, input, and other actions.

```ts
import { build } from '@bunnarray/compiler';
import { createVM } from '@bunnarray/vm';

const program = build(`
:SPEAKER Guide
Hello, $player.
Which way should we go? {
    ?: [id:forest] Into the forest
        :SET route = forest
        :YIELD transition:forest
        Let's take the forest path.
    ?: [id:warren] Back to the warren
        :SET route = warren
        :YIELD transition:warren
        Let's head back to warren.
}
:SIGNAL route_chosen
`);

const vm = createVM(program, {
    memory: { player: 'Hazel' },
    onEmission: (emission) => {
        switch (emission.kind) {
            case 'say':
                showLine(emission.speaker, emission.text);
                break;
            case 'memory':
                saveMemory(emission.key, emission.value);
                break;
            case 'signal':
                handleSignal(emission.identifier, emission.value);
                break;
        }
    },
    onPause: (pause) => {
        switch (pause.kind) {
            case 'next':
                showContinueButton(() => pause.resume());
                break;
            case 'select':
                showOptions(pause.options, (index) => pause.resume(index));
                break;
            case 'yield':
                handleAction(pause.identifier, pause.value, () => pause.resume());
                break;
            case 'end':
                cleanupDialogue();
                break;
            case 'error':
                showDialogueError(pause.error);
                break;
        }
    }
});

vm.start();
```
