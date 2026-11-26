# @galeedgutierrez/frontend-config

Shared frontend configs for Astro projects, and an Astro integration with the
post-build CSS, font and CSP steps.

```sh
npm install --save-dev @galeedgutierrez/frontend-config
```

Each config is a subpath export. The tools themselves (stylelint, Prettier,
UnoCSS, Astro…) stay the project's own dependencies; the plugins and presets the
configs load come with this package.

## The post-build steps (`/astro`)

```js
// astro.config.mjs
import { optimize } from "@galeedgutierrez/frontend-config/astro";

export default defineConfig({
  integrations: [
    // …the other integrations first: optimize() must see their output.
    optimize({
      purgeCss: { safelist: { standard: [/^data-theme/, "aria-current"] } },
      cspHeaders: { sources: { "img-src": ["https://images.example"] } },
    }),
  ],
});
```

After `astro build`, in this order (each step takes its options, or `false` to
skip it):

- `purgeCss`: drops the selectors no built page or script uses. `safelist` adds
  selectors set at runtime, by attribute NAME (`/^data-theme/`): patterns like
  `/^\[data-.*\]$/` match nothing. Keeps UnoCSS arbitrary values
  (`aspect-[5/4]`).
- `lightningCss`: minifies and lowers the CSS to the project's `browserslist`,
  and prints what it couldn't parse or lower.
- `pruneCssVariables`: drops the custom properties nothing reads, across every
  style sheet, page and script at once (tokens are declared in one sheet and
  used in another).
- `subsetFonts`: subsets every font to the characters the pages use, drops the
  `@font-face` rules no character needs and the WOFF fallbacks, and renames
  fonts and style sheets by content hash. `safetyCharacters` adds text a script
  inserts at runtime; `pinnedAxes` pins variable fonts used at one weight.
- `inlineCss`: replaces each style sheet link with a `<style>` and deletes the
  file (worth it while the CSS is a few KB).
- `cspHeaders` (off by default): hashes every inline script and `<style>` and
  writes the Content-Security-Policy into the build's `_headers` (Cloudflare).
  Report-only until `reportOnly: false`.

A failed step fails the build. The order matters: `subsetFonts` renames files by
content hash, so no later step may rewrite the CSS; `cspHeaders` hashes the
final HTML. Never add a PostCSS pass after `lightningCss`:
`postcss-custom-properties` would inline the `light-dark()` switches and pin
every color to light.

The steps are also exported from `/steps`, to run without the integration or to
test a project's own policy (`buildPolicy`, `buildPartytownPolicy`).

### Content-Security-Policy

The page policy is same-origin only: `script-src` and `style-src` allow inline
code by hash, `object-src`, `base-uri`, `form-action` and `frame-ancestors` are
`'none'`. `sources` adds what the site loads from elsewhere, per directive;
`'unsafe-inline'` and `'unsafe-eval'` are rejected.

`partytown` adds a separate policy for `/~partytown/*`, which needs `eval` and
`blob:` workers. Keep the page's `_headers` with a single `/*` rule: a second
one replaces the first on Cloudflare.

## Git dates (`/git` and `galeed-git-history`)

`getLastModified()` returns the date of the last commit that touched `src`,
`public` or the lockfile, for the sitemap `lastmod` and a page's `dateModified`.
On a shallow clone (Cloudflare Pages) that is the latest commit, so run
`galeed-git-history` before the build:

```json
"build": "galeed-git-history && astro build"
```

## Linters and formatters

```js
// stylelint.config.js: breakpoints are the project's.
export default {
  extends: ["@galeedgutierrez/frontend-config/stylelint"],
  rules: {
    "media-feature-name-value-allowed-list": {
      width: ["40em", "48em", "64em", "90em"],
    },
  },
};
```

```json
// package.json
"prettier": "@galeedgutierrez/frontend-config/prettier"
```

```js
// commitlint.config.js
export { default } from '@galeedgutierrez/frontend-config/commitlint';

// .lintstagedrc.js
export { default } from '@galeedgutierrez/frontend-config/lint-staged';

// .markdownlint-cli2.mjs
import { markdownlint } from '@galeedgutierrez/frontend-config/markdownlint';

export default markdownlint({ ignores: ['DESIGN_SYSTEM.md'] });
```

```js
// .textlintrc.cjs
module.exports = require("@galeedgutierrez/frontend-config/textlint").textlint({
  terms: ["Sonda"],
});

// lighthouserc.cjs
module.exports =
  require("@galeedgutierrez/frontend-config/lighthouse").lighthouse({
    paths: ["/", "/404.html"],
    blockedUrlPatterns: ["*googletagmanager.com*", "*google-analytics.com*"],
  });
```

## CSS pipeline

```js
// postcss.config.js
import { postcssConfig } from "@galeedgutierrez/frontend-config/postcss";

export default postcssConfig({ utopia: { minWidth: 360, maxWidth: 448 } });
```

Mixins from `src/styles/tools/*.css`, `:root` custom properties inlined (per
file: CSS Modules don't see `:root` and keep their `var()`), Utopia's
`utopia.clamp()`, and cssnano's advanced preset in builds only, without the four
plugins that assume they see the whole site.

```ts
// uno.config.ts
import { unoConfig } from "@galeedgutierrez/frontend-config/unocss";

export default unoConfig({
  breakpoints: { sm: "40em", md: "48em", lg: "64em", xl: "90em" },
});
```

UnoCSS for layout only: color, type, border, radius, shadow and motion utilities
are blocklisted, and the output is rewritten to logical properties and range
media queries, the same rules stylelint enforces on hand-written CSS. A second
argument merges anything else over it.

## Reference: galeed.link

galeed.link uses every piece. Its site-specific values, for a new project to
start from:

```js
optimize({
  purgeCss: {
    // Set by the theme script and the section nav at runtime.
    safelist: { standard: [/^data-theme/, "aria-current"] },
  },
  subsetFonts: {
    // JetBrains Mono only renders at weight 500.
    pinnedAxes: { "jetbrains-mono-": { wght: 500 } },
  },
  cspHeaders: {
    sources: {
      "script-src": [
        "https://*.googletagmanager.com",
        // Cloudflare Web Analytics, injected at the edge.
        "https://static.cloudflareinsights.com",
      ],
      "img-src": [
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.googletagmanager.com",
      ],
      "connect-src": [
        "https://*.google-analytics.com",
        "https://*.analytics.google.com",
        "https://*.googletagmanager.com",
        "https://cloudflareinsights.com",
      ],
    },
    // gtag runs in Partytown's worker.
    partytown: {
      sources: {
        "script-src": ["https://*.googletagmanager.com"],
        "img-src": [
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
        ],
        "connect-src": [
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
        ],
      },
    },
  },
});
```
