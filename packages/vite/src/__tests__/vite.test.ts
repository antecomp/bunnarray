import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build, createServer } from 'vite';
import bunnarray from '../index';

const root = fileURLToPath(new URL('../../fixtures/', import.meta.url));

describe('@bunnarray/vite', () => {
    it('loads compiled programs in dev while preserving raw imports', async () => {
        const server = await createServer({
            root,
            configFile: false,
            plugins: [bunnarray()],
            server: { middlewareMode: true, hmr: false }
        });

        try {
            const { story, rawSource, run } = await server.ssrLoadModule('/consumer.ts');
            expect(story.version.major).toBe(1);
            expect(rawSource).toBe('Hello from a .bny import.\n');
            expect(run()).toEqual({
                wait: { kind: 'end' },
                emissions: [
                    { kind: 'say', text: 'Hello from a .bny import.', speaker: null },
                    { kind: 'end' }
                ]
            });
            await expect(server.transformRequest('/invalid.bny')).rejects.toMatchObject({
                message: expect.stringContaining('line 1, column 6'),
                loc: { line: 1, column: 5 }
            });
        } finally {
            await server.close();
        }
    });

    it('keeps the compiler out of the production bundle', async () => {
        const output = await build({
            root,
            configFile: false,
            plugins: [bunnarray()],
            build: {
                write: false,
                minify: false,
                lib: { entry: fileURLToPath(new URL('../../fixtures/consumer.ts', import.meta.url)), formats: ['es'] }
            }
        });

        const chunks = (Array.isArray(output) ? output : [output])
            .flatMap(result => 'output' in result ? result.output : [])
            .filter(item => item.type === 'chunk');
        const moduleIds = chunks.flatMap(chunk => Object.keys(chunk.modules));

        expect(moduleIds.some(id => id.endsWith('/story.bny'))).toBe(true);
        expect(moduleIds.some(id => id.includes('/packages/compiler/') || id.includes('/node_modules/chevrotain/'))).toBe(false);
        expect(chunks.map(chunk => chunk.code).join('\n')).toContain('Hello from a .bny import.');
    });
});
