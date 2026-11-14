Compiles BunNarraY (`.bny`) [dialogues](https://github.com/antecomp/bunnarray/blob/main/doc/language.md) into a [`BnyProgram` for `@bunnarray/vm`](../vm/README.md).
See project at https://github.com/antecomp/bunnarray/

```shell
npm install @bunnarray/compiler`
```

The core export from this package is the `build` function that takes in raw BunNarraY-syntax text and returns a compiled `BnyProgram` to be used with the [BunNarraY vm](https://github.com/antecomp/bunnarray/tree/main/packages/vm) (or your own interpreter!).

`build` has the following shape:
```ts
build(source: string)
```
That's it.


### Compiler Errors
TODO