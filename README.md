# frontend-config

Shared configs for Galeed Gutierrez's Astro projects, published to npm:

- [`@galeedgutierrez/tsconfig`](packages/tsconfig): strict TypeScript.
  `base.json` for any project, `astro.json` for Astro (path aliases included).
- [`@galeedgutierrez/eslint-config`](packages/eslint-config): the ESLint flat
  config. Type-checked TypeScript, Astro, JSON, YAML, Vitest and Playwright.
- [`@galeedgutierrez/frontend-config`](packages/frontend-config): the stylelint,
  Prettier, commitlint, PostCSS, UnoCSS, markdownlint, textlint, Lighthouse CI
  and lint-staged configs, plus an Astro integration that runs the post-build
  CSS, font and CSP steps.

A project extends these instead of copying them, so a fix reaches every project
as a version bump (Renovate or Dependabot opens the pull request).

## What a project still keeps

Files that can't be extended stay in each project, copied once:

- `.editorconfig`: Prettier reads indentation, print width and quotes from it.
- `.nvmrc` (Node 26 or later) and the `browserslist` field of `package.json`:
  `"browserslist": ["baseline widely available with downstream"]`.
- The Husky hooks (`.husky/`), which run `npm run lint:all` and
  `npm run verify`.
- `public/_headers` (Cloudflare), which the CSP step completes.

## Development

```sh
npm install
npm run verify   # build, every linter, types, tests, publint and attw
```

The repository lints and formats itself with its own packages. Each pull request
that changes a published package adds a changeset (`npm run changeset`).

## Releases

The release workflow runs on `main`:

1. With pending Changesets, it opens a "chore: version packages" pull request
   with the new versions and changelogs.
2. Merging that pull request publishes them to npm with trusted publishing
   (OIDC, no npm token stored anywhere) and provenance.

A new package needs one manual first publish, because npm only lets an existing
package trust a workflow. See
[the first-publish steps](CLAUDE.md#first-publish-of-a-new-package).

## License

[MIT](LICENSE)
