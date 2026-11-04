# Developing BunNarraY

This repository is an npm workspace. The packages are `@bunnarray/compiler`, `@bunnarray/vm`, and `@bunnarray/vite`; the browser playground is under `apps/playground`. The declarative VS Code extension is under `tools/vscode-bny`.

## Setup and commands

Use a Node.js version supported by the installed toolchain (currently Node 22.18+, 24.11+, or 26+), then run from the repository root:

```sh
npm ci
npm run dev
```

`npm run dev` starts the playground's Vite development server. In the browser, edit the example script and select **Compile** to see its VM program and play the dialogue.

Other root commands:

| Command | Purpose |
| --- | --- |
| `npm run build:packages` | Build VM, compiler, then Vite plugin. |
| `npm run build` | Build packages, type-check with `tsc`, and build the playground. |
| `npm test` | Build packages and run the Vitest suite. |
| `npm run lint` | Check TypeScript files with ESLint. |
| `npm run preview` | Preview a built playground. |

Run these commands from the repository root. `build` and `test` run their package builds first through npm's `prebuild` and `pretest` scripts.

## Where to make changes

- `packages/compiler/src/language` contains tokenization, parsing, and AST conversion. `build.ts` normalizes source and reports syntax diagnostics; `lower.ts` produces VM instructions.
- `packages/vm/src` is for the interpreter VM. It contains instruction types, execution, memory, and pause scheduling. The public API is exported from `index.ts`.
- `packages/vite/src` Is for the vite plugin. It transforms plain `.bny` imports to program modules. `client.d.ts` declares the TypeScript import type.
- `apps/playground/src` contains the browser editor, instruction display, and interactive runner.