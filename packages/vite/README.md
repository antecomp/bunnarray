# @bunnarray/vite

Compile `.bny` imports into [BunNarraY](https://github.com/antecomp/bunnarray) VM programs during Vite development and production builds.

Install `@bunnarray/vite` and `@bunnarray/vm` in a Vite 6, 7, or 8 project, then add the plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import bunnarray from '@bunnarray/vite';

export default defineConfig({ plugins: [bunnarray()] });
```

For TypeScript projects, add `@bunnarray/vite/client` to `compilerOptions.types` alongside `vite/client`:

```json
{
  "compilerOptions": {
    "types": ["vite/client", "@bunnarray/vite/client"]
  }
}
```

Plain `.bny` imports have type `BnyProgram` and can be passed directly to the VM:

```ts
import story from './story.bny';
import { createVM } from '@bunnarray/vm';

const vm = createVM(story, { ... });
vm.start();
```