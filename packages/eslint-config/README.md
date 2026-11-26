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
- Folder names follow `check-file/folder-naming-convention` (kebab-case under
  `src/`); `unicorn/filename-case` only checks filenames.
- Don't use Astro's shorthand attributes (`<h2 {id}>`): they crash the
  `jsx-a11y-x` rules. Write `id={id}`.
- The React block is commented out in `index.js`: the starting point for an
  Astro + React config.
