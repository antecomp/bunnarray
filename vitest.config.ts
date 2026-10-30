import { fileURLToPath } from 'node:url';
import { defaultInclude, defineConfig } from 'vitest/config';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    test: {
        include: defaultInclude.map(pattern => `{packages,apps}/${pattern}`)
    }
});
