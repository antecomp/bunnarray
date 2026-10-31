declare module '*.bny' {
    import type { BnyProgram } from '@bunnarray/vm';

    const program: BnyProgram;
    export default program;
}
