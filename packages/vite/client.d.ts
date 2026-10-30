declare module '*.bny' {
    import type { Program } from '@bunnarray/vm';

    const program: Program;
    export default program;
}
