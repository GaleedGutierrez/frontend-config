# @galeedgutierrez/tsconfig

Strict TypeScript configs.

```sh
npm install --save-dev @galeedgutierrez/tsconfig
```

## Astro

```json
{
  "extends": "@galeedgutierrez/tsconfig/astro.json"
}
```

`astro.json` extends `astro/tsconfigs/strict` and `base.json`, and adds:

- **Path aliases** for the usual folders (`@/*` → `src/*`, `@components/*`,
  `@layouts/*`, `@styles/*`, `@utils/*`, `@shared/*`…). They are written with
  `${configDir}`, so they resolve from the project's tsconfig.json, not from
  this package. Astro reads them for Vite too.
- **`include` and `exclude`**: the project, minus `dist`, `coverage`,
  `playwright-report`, `test-results` and `.lighthouseci`. Setting `exclude` in
  a project replaces this list, so repeat it there when adding a folder.

## Any project

```json
{
  "extends": "@galeedgutierrez/tsconfig/base.json",
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext"
  }
}
```

`base.json` only sets checks, never the module system or the output:

- `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `noUncheckedIndexedAccess`: a regular expression group or an array element is
  `T | undefined`.
- `noImplicitReturns`, `noImplicitOverride`, `allowUnreachableCode: false`,
  `allowUnusedLabels: false`
- `erasableSyntaxOnly` (Node runs the files with type stripping),
  `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames`

Left out on purpose, from Astro's `strictest`:

- `exactOptionalPropertyTypes`: mostly friction with `schema-dts` types.
- `noPropertyAccessFromIndexSignature`: fights ESLint's `dot-notation` and
  `element.dataset.x`.
