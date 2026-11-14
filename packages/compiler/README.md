Compiles BunNarraY (`.bny`) [dialogues](https://github.com/antecomp/bunnarray/blob/main/doc/language.md) into programs for [`@bunnarray/vm`](https://github.com/antecomp/bunnarray/tree/main/packages/vm).
See the project at https://github.com/antecomp/bunnarray/.

```shell
npm install @bunnarray/compiler
```

The core export from this package is `build`, which takes raw BunNarraY dialogue text and returns a compiled `BnyProgram` to run in the VM (or your own interpreter!).

`build` has the following shape:
```ts
build(source: string) => BnyProgram
```

Pass in the dialogue text itself, such as a string you've read from a `.bny` file. `build` runs synchronously and returns the program. The `BnyProgram` type is exported by `@bunnarray/vm`.

### For example,
you can compile a short dialogue like this:

```ts
import { build } from '@bunnarray/compiler';

const program = build(`
:SPEAKER Guide
Hello, $player.
Which way should we go? {
    ?: Into the forest
        Let's take the forest path.
    ?: Back to the warren
        Let's head back to the warren.
}
`);
```

Pass `program` to `createVM` when you're ready to run it. See the [VM README](https://github.com/antecomp/bunnarray/tree/main/packages/vm#full-example) for a full example with display and input handlers.

If you're using Vite, [`@bunnarray/vite`](https://github.com/antecomp/bunnarray/tree/main/packages/vite) lets you import `.bny` files directly and compiles them during development and production builds.

## Compiler errors

`build` throws a `CompilerSyntaxError` if the dialogue has invalid syntax or a problem such as a duplicate label or a jump to an unknown label. No program is returned when compilation fails.

`CompilerSyntaxError` extends JavaScript's `SyntaxError`. Its `message` includes the kind of error, line, column, and a description of the problem. For example, compiling `->missing` produces:

```text
Semantic error at line 1, column 1: encountered goto to unknown label: missing
```

For display in an editor or other tooling, the error also has a `diagnostics` array. Each entry has the following shape, exported as the `SyntaxDiagnostic` type:

```ts
interface SyntaxDiagnostic {
    kind: 'lex' | 'parse' | 'semantic';
    message: string;
    line: number;
    column: number;
    offset: number;
}
```

The `kind` tells you where compilation failed:

| `kind` | Meaning |
| --- | --- |
| `lex` | The compiler could not recognize part of the source, such as an invalid character in an identifier. |
| `parse` | The source does not follow the language's structure, such as a choice missing its closing brace. |
| `semantic` | The source has a duplicate label or a jump to an unknown label. |

Lines and columns start at 1; offsets start at 0. Locations refer to the source after normalizing line endings to `\n` and adding a final newline if needed. An error at the end of the input can point just after that final newline.

### For example,
you could handle compiler errors like this:

```ts
import { build, CompilerSyntaxError } from '@bunnarray/compiler';

try {
    const program = build('->missing');
    // Store the program or pass it to createVM here.
} catch (error) {
    if (!(error instanceof CompilerSyntaxError)) throw error;

    for (const diagnostic of error.diagnostics) {
        console.error(`Line ${diagnostic.line}, column ${diagnostic.column}: ${diagnostic.message}`);
    }
}
```

The compiler stops at the first stage that fails. The diagnostics describe the errors found at that stage, so you may need to compile again after fixing them to find further issues.
