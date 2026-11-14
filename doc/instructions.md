This guide covers the compiled instruction set. For writing dialogue, check the [language guide](./language.md).

Dialogue compiled with the [BunNarraY compiler](../packages/compiler/README.md) becomes a `BnyProgram`: an array of human-readable instructions and a version. The [VM](../packages/vm/README.md) runs those instructions to emit dialogue, handle choices, and update memory.

Each instruction is a `BnyInstruction`, identified by its `op` property. The other fields depend on the opcode. All types in this guide are exported by `@bunnarray/vm`.

## Programs & execution

A program has the following shape:

```ts
type BnyProgram = {
    instructions: BnyInstruction[];
    version: {
        major: number;
        minor: number;
        patch?: string;
    };
};
```

Instructions begin at index `0` and typically moves to the next instruction after executing one. `JUMP`, `BRANCH`, and `CHOICE` can move execution to another index. Every `target` and `fallback` is an absolute, zero-based index into `instructions`.

Labels are resolved to instruction indexes during compilation, so there is no label opcode. Skip blocks become jumps, and the compiler adds jumps after choice and branch bodies so they continue after the block. A target does not act like a function call: there is no automatic return to where execution came from.

## Conditions

`CHOICE` and `BRANCH` use `BnyCondition` to test the current memory:

| Field | Type | Meaning |
| --- | --- | --- |
| `identifier` | `string` | Memory key to test. |
| `value` | `string` (optional) | Expected value after variable expansion. Omit to test just if the key exists. |
| `negated` | `true` (optional) | Invert the result, as with `unless` in the language. |

For example, `{ identifier: 'has_key', value: 'yes' }` matches when `has_key` is set to `'yes'`. `{ identifier: 'has_key', negated: true }` matches when that key is absent.

> Note: the language does not support a way to set memory to empty strings, so be wary of them for existence and equality checks.

## Note: Variable expansion

The VM implementation and expectation is that `$identifier` strings are expanded with current memory values. However, this is not enforced with any sort of templating in the instruction-set. `SAY`, `SET` and other instructions plainly include `$identifier` as a string.

## Opcodes

### SAY

Emits a line of dialogue using the current speaker.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'SAY'` | Opcode. |
| `text` | `string` | Dialogue text. |

### CHOICE

Offers dialogue options and jumps to the selected option's body.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'CHOICE'` | - |
| `choices` | `{ text: string; target: number; condition?: BnyCondition; id?: string }[]` | Options in display order. |
| `fallback` | `number` | Instruction index to jump to if no options are visible. |

Each choice has the following fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `text` | `string` | Option text to show the player. |
| `target` | `number` | Instruction index to jump to when selected. |
| `condition` | `BnyCondition` (optional) | Show this option only if the condition matches. Omit to always show it. |
| `id` | `string` (optional) | ID passed to the host for custom display or tracking. |

### BRANCH

Tests conditions in order and jumps to the first matching case.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'BRANCH'` | - |
| `cases` | `{ condition: BnyCondition; target: number }[]` | Conditions and their destination indexes, in test order. |
| `fallback` | `number` | Instruction index to jump to if no case matches. |

### JUMP

Moves execution directly to another instruction. This is used for gotos, skip blocks, and continuing after choice or branch bodies.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'JUMP'` | - |
| `target` | `number` | Instruction index to execute next. |

### SET

Sets or deletes a memory entry.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'SET'` | - |
| `identifier` | `string` | Memory key to update. |
| `value` | `string \| null` | Value to set after variable expansion, or `null` to delete the key. |

### SIGNAL

Emits a notification and continues immediately.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'SIGNAL'` | - |
| `identifier` | `string` | Name of the signal. |
| `value` | `string` (optional) | Additional value passed to the host. |

### YIELD

Pauses execution for the host to complete an action.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'YIELD'` | - |
| `identifier` | `string` | Name of the action. |
| `value` | `string` (optional) | Additional value passed to the host. |

### SPEAKER

Sets the speaker for following dialogue lines and stops any speaker rotation.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'SPEAKER'` | - |
| `value` | `string \| null` | Speaker name, or `null` for no speaker. |

### ALTERNATE

Rotates speakers on following *dialogue* lines (not each instruction).

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'ALTERNATE'` | - |
| `speakers` | `(string \| null)[]` | Speaker names in rotation order; `null` means no speaker for that turn. |

### END

Ends the dialogue.

| Field | Type | Meaning |
| --- | --- | --- |
| `op` | `'END'` | Opcode; no other fields are needed. |

## Full example

This program offers one option, updates memory when it is selected, and emits a line using that value:

```ts
import type { BnyProgram } from '@bunnarray/vm';

const program: BnyProgram = {
    version: { major: 1, minor: 0, patch: 'indev' },
    instructions: [
        { op: 'SPEAKER', value: 'Guide' },
        { op: 'SAY', text: 'Which way should we go?' },
        {
            op: 'CHOICE',
            choices: [{ text: 'Into the forest', target: 3 }],
            fallback: 6
        },
        { op: 'SET', identifier: 'route', value: 'forest' },
        { op: 'SAY', text: "Let's take the $route path." },
        { op: 'JUMP', target: 6 },
        { op: 'END' }
    ]
};
```
