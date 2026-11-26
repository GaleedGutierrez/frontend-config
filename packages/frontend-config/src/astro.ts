/**
 * Astro integration: runs the post-build steps on the static output, in the
 * only order that works.
 *
 * 1. purgeCss: drops the selectors no page or script uses.
 * 2. lightningCss: minifies and lowers to the browserslist targets.
 * 3. pruneCssVariables: drops the custom properties nothing reads (after
 *    lightningCss, whose light-dark() polyfill adds some).
 * 4. subsetFonts: subsets the fonts and renames fonts and style sheets by
 *    content hash, so any later step that rewrote the CSS would leave a
 *    stale hash.
 * 5. inlineCss: replaces each style sheet link with a `<style>` element.
 * 6. cspHeaders: hashes the final HTML, those `<style>` elements included.
 *
 * Put it last in `integrations`: other integrations' `astro:build:done`
 * hooks (sitemap, Partytown) run before it, so it sees the final output. A
 * failed step fails the build.
 */
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

import { cspHeaders, type CspOptions } from './steps/cspHeaders.ts';
import { inlineCss, type InlineCssOptions } from './steps/inlineCss.ts';
import { lightningCss } from './steps/lightningCss.ts';
import { pruneCssVariables } from './steps/pruneCssVars.ts';
import { purgeCss, type PurgeCssOptions } from './steps/purgeCss.ts';
import type { Logger, StepContext } from './steps/shared.ts';
import { subsetFonts, type SubsetFontsOptions } from './steps/subsetFonts.ts';

/** Each step takes its options, or `false` to skip it. */
export interface OptimizeOptions {
	purgeCss?: false | PurgeCssOptions;
	lightningCss?: boolean;
	pruneCssVariables?: boolean;
	subsetFonts?: false | SubsetFontsOptions;
	inlineCss?: false | InlineCssOptions;
	/** Off by default: it writes a Cloudflare `_headers` file. */
	cspHeaders?: false | CspOptions;
}

/**
 * The integration.
 * @param options - Each step's options, or `false` to skip it.
 * @returns The Astro integration.
 */
export const optimize = ({
	purgeCss: purgeCssOptions = {},
	lightningCss: isLightningCssOn = true,
	pruneCssVariables: isPruneCssVariablesOn = true,
	subsetFonts: subsetFontsOptions = {},
	inlineCss: inlineCssOptions = {},
	cspHeaders: cspOptions = false,
}: OptimizeOptions = {}): AstroIntegration => {
	let root = process.cwd();
	let assets = '_astro';

	return {
		name: '@galeedgutierrez/frontend-config',
		hooks: {
			'astro:config:done': ({ config }): void => {
				root = fileURLToPath(config.root);
				assets = config.build.assets;
			},
			'astro:build:done': async ({ dir, logger }): Promise<void> => {
				const context: StepContext = {
					dir: fileURLToPath(dir),
					assets,
					logger: logger satisfies Logger,
				};

				if (purgeCssOptions) {
					await purgeCss(context, purgeCssOptions);
				}

				if (isLightningCssOn) {
					lightningCss(context, { root });
				}

				if (isPruneCssVariablesOn) {
					pruneCssVariables(context);
				}

				if (subsetFontsOptions) {
					await subsetFonts(context, subsetFontsOptions);
				}

				if (inlineCssOptions) {
					inlineCss(context, inlineCssOptions);
				}

				if (cspOptions) {
					cspHeaders(context, cspOptions);
				}
			},
		},
	};
};

export default optimize;
