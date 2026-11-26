# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## frontend-config

npm workspaces monorepo with Galeed Gutierrez's shared configs, published as
`@galeedgutierrez/tsconfig`, `@galeedgutierrez/eslint-config` and
`@galeedgutierrez/frontend-config`. Astro only for now; an Astro + React variant
comes later, starting from the commented React block in
`packages/eslint-config/index.js`. Node 26 or later (`.nvmrc`), ESM.

Code, comments, commits and docs are English. A few Spanish comments came with
the configs (PurgeCSS safelist, the UnoCSS `w-` rule): keep them.

## These are templates

Every project extends these packages, so:

- Fix bugs and make improvements that hold in any project. Don't remove a
  section because one project doesn't use it (the React block, the
  class-ordering rules, the broad PurgeCSS safelist, the UnoCSS `w-` rule with
  its `--max-w-*` fallbacks).
- A project-specific value (breakpoints, a safelist entry, CSP sources, pinned
  font axes) is an option, never a hardcoded default. The galeed.link values are
  in `packages/frontend-config/README.md` as a reference.
- UnoCSS' own `sr-only` utility is used in every project: never blocklist it.
- A change in behavior is a changeset (`npm run changeset`): patch for a fix,
  minor for an option or rule, major for anything that breaks a project's lint
  or build. Before 1.0.0, a minor can break.

## Commands

| Task                         | Command                                     |
| ---------------------------- | ------------------------------------------- |
| Build the packages           | `npm run build`                             |
| Lint (ESLint, own config)    | `npm run lint` · `npm run lint:fix`         |
| Format                       | `npm run prettier` · `npm run prettier:fix` |
| Lint Markdown                | `npm run lint-md`                           |
| Type check                   | `npm run typecheck`                         |
| Tests (Vitest)               | `npm run test`                              |
| publint + attw               | `npm run check-package`                     |
| Everything (pre-push and CI) | `npm run verify`                            |
| Add a changeset              | `npm run changeset`                         |

The repository lints itself with its own packages: `npm run build` first on a
fresh clone, because Prettier and commitlint load the built `frontend-config`.

## Structure

- `packages/tsconfig/`: `base.json` (checks only) and `astro.json` (extends
  `astro/tsconfigs/strict` and `base.json`, adds the path aliases). Paths,
  `include` and `exclude` use `${configDir}` so they resolve from the project,
  not from `node_modules`.
- `packages/eslint-config/`: plain JS (`index.js`) with hand-written types
  (`index.d.ts`), so it needs no build. `galeed({ tsconfigRootDir, ignores })`
  returns the flat config array.
- `packages/frontend-config/src/`: TypeScript, compiled to `dist/` (Node refuses
  to strip types under `node_modules`).
  - One module per tool config (`stylelint.ts`, `prettier.ts`…), each a subpath
    export.
  - `astro.ts`: the `optimize()` integration; `steps/`: the post-build steps,
    also exported from `/steps` (not `build/`: the shared ESLint config ignores
    `**/build/**` as an output folder).
  - `git.ts` and `bin/gitHistory.ts` (`galeed-git-history`).
- `packages/frontend-config/tests/`: Vitest. `configs.test.ts` loads every
  config with its own tool; `unocss.test.ts` lints the UnoCSS output with the
  stylelint rules; `steps.test.ts` runs the steps on a fake build output.

## Gotchas

- A config that names a plugin or preset resolves it with `import.meta.resolve`
  to an absolute path (Prettier's `prettier-plugin-astro`, commitlint's
  `extends`): the tools resolve names from the project, where this package's
  dependencies may not be hoisted.
- Adding a subpath export needs an entry in `exports` with `types` and
  `default`; `npm run check-package` fails otherwise.
- `postcss-utopia` ships types for a module named `utopia`:
  `src/types/postcssUtopia.d.ts` declares the real name.
- `subset-font` ships no types: `src/types/subsetFont.d.ts`.
- `unicorn/filename-case` names both files and folders (no
  `eslint-plugin-check-file`). Folders are checked only below `FOLDER_ROOTS`
  (`src`, the test folders), through `directoryRoots` in their own `files`
  block: with no matching root, unicorn 80 checks every folder, a monorepo's
  kebab-case package folders included. Its options are shared by files and
  folders, so folders accept PascalCase too. `src/pages/` has its own block:
  routes are URLs, so kebab-case files, unchecked folders, `[param]` skipped.
- The post-build steps take the output folder from Astro (`dir`) and the assets
  folder from `build.assets`: never
  `path.join(import.meta.dirname, '..', 'dist')`, which pointed inside the
  package.
- PurgeCSS gets the pages as raw content, not globs: PurgeCSS 9 globs paths, and
  an absolute Windows path matched nothing.

## First publish of a new package

npm only lets an existing package trust a workflow, so a new package is
published once by hand, without provenance (it needs CI):

1. `npm login`, then `npm run build`.
2. `npm publish --workspace <name> --provenance=false`.
3. On npmjs.com, the package's settings → Trusted publishing → GitHub Actions:
   owner `GaleedGutierrez`, repository `frontend-config`, workflow
   `release.yml`.
4. Then require 2FA and disallow tokens for publishing.

Every later version goes through the release workflow.

## Workflow

- Conventional Commits (commitlint, the repository's own config). Commits are
  GPG-signed; never bypass signing or hooks.
- Husky: commit-msg runs commitlint; pre-commit runs lint-staged and `lint:all`;
  pre-push runs commitlint over the pushed commits and `npm run verify`.
- Work on a branch, never directly on `main`.
- CI (`ci.yml`) runs `npm run verify` and commitlint on every pull request.
  `release.yml` versions and publishes from `main`.
