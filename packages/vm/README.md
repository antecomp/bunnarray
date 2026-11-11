Run BunNarray dialogues compiled by [`@bunnarray/compiler`](https://www.npmjs.com/package/@bunnarray/compiler?activeTab=readme) or imported through [`@bunnarray/vite`](https://www.npmjs.com/package/@bunnarray/vite?activeTab=readme).
See project at: https://github.com/antecomp/bunnarray/

```shell
npm install @bunnarray/compiler
```

The core export from this package is the `createVM` function. This will configure a BunNarraY interpreter to run through compiled dialogue programs. 

`createVM` is of the following shape:
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

In short, the `program` is a compiled BunNarraY program ([see project overview](https://github.com/antecomp/bunnarray/)), `onEmission` is a callback for whenever the VM makes an "emission" as it runs through the dialogue -- things such as lines of text or signals. This is what you'd wire up to your dialogue display code. `onPause` is a callback for whenever the vm "pauses" -- meaning it needs user input such advancing through lines of text or selecting options. This is what you'd wire up to your player input code. The optional `memory` snapshot is a record of variables you'd like to set before starting the dialogue, such as pulling in game state.

`createVM` then returns a simple `vm` interface: `memory` and `start`.
- `memory` lets you interface with the vm memory directly (subscribe to memory updates, modify memory, or snapshot it).
- `start` starts the vm in running the dialogue. After this, continuing through it is the responsibility of the `onPause` handler. More on that below.