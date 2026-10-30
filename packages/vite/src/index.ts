import { build, CompilerSyntaxError } from '@bunnarray/compiler';
import type { Plugin } from 'vite';

/** Compile plain .bny imports into VM programs during Vite's module transform. */
export default function bunnarray(): Plugin {
    return {
        name: 'bunnarray',
        enforce: 'pre',
        transform(source, id) {
            // Query imports such as ?raw and ?url belong to Vite's asset plugins.
            if (!id.endsWith('.bny')) return null;

            try {
                const program = build(source);
                return { code: `export default ${JSON.stringify(program)};`, map: null };
            } catch (error) {
                if (error instanceof CompilerSyntaxError) {
                    const first = error.diagnostics[0];
                    this.error({
                        message: error.message,
                        id,
                        ...(first && {
                            loc: { file: id, line: first.line, column: first.column - 1 }
                        })
                    });
                }

                this.error({
                    message: error instanceof Error ? error.message : String(error),
                    id
                });
            }
        }
    };
}
