For the actual base language, check the [language guide](./language.md). This is for the compiled instruction-set.

Dialogue compiled with the [BunNarraY compiler](https://github.com/antecomp/bunnarray/tree/main/packages/compiler) is composed of `BnyInstruction`s. These instructions operate as an human-readable IR for a [VM](https://github.com/antecomp/bunnarray/tree/main/packages/vm).

Instructions are identified by their opcode, noted as the `op` property on an instruction. The data held for each instruction varies on its purpose.

