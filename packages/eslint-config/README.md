# @galeedgutierrez/eslint-config

The ESLint flat config of every project: JavaScript, type-checked TypeScript
(`strictTypeChecked` + `stylisticTypeChecked`), Astro, JSON, YAML, Vitest
(`tests/`) and Playwright (`tests/e2e/`). Prettier formats; this only turns off
the rules that fight it.

```sh
npm install --save-dev @galeedgutierrez/eslint-config eslint typescript
```

```js
// eslint.config.js
import { galeed } from "@galeedgutierrez/eslint-config";

export default galeed({ tsconfigRootDir: import.meta.dirname });
```

## Options

- `tsconfigRootDir` (required): where the project's tsconfig.json is, for the
  type-checked rules.
- `ignores` (default `[]`): extra globs to ignore, on top of `dist`, `build`,
  `coverage`, the test reports, `.astro`, `.agents` and `.claude`.

## Project rules

The result is a plain config array: add a project's own rules after it.

```js
export default [
  ...galeed({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ["src/scripts/theme.ts"],
    rules: { "unicorn/dom-node-dataset": "off" },
  },
];
```

## Notes

- Every disable comment needs a `-- reason`, and one that no longer suppresses
  anything fails the lint.
- `unicorn/filename-case` names files and folders: camelCase or PascalCase, with
  folders checked only below `src/` and the test folders (`test`, `tests`,
  `cypress`, `puppeteer`, `playwright`). Pages under `src/pages/` are routes, so
  their files are kebab-case (`my-projects.astro`), their folders unchecked and
  dynamic routes (`[slug].astro`) skipped.
- Don't use Astro's shorthand attributes (`<h2 {id}>`): they crash the
  `jsx-a11y-x` rules. Write `id={id}`.
- The React block is commented out in `index.js`: the starting point for an
  Astro + React config.
