/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: replaces each page's `/_astro/*.css` links with `<style>`
 * elements.
 *
 * For a site whose whole CSS is a few KB compressed, a separate request only
 * costs a round trip before the first paint (PageSpeed's "render-blocking
 * requests"). Runs after subsetFonts, which renames the style sheets, and
 * before cspHeaders, which hashes the new `<style>` elements.
 */
import fs from 'node:fs';
import path from 'node:path';

import { consoleLogger, filesIn, type StepContext } from './shared.ts';

const LINK_PATTERN = /<link\b[^>]*>/gi;
const STYLESHEET_PATTERN = /\brel=["']?stylesheet["'\s>]/i;

/**
 * Matches the `href` of a style sheet in the assets folder.
 * @param assets - Astro's `build.assets` folder name.
 * @returns The pattern; the path is its first group.
 */
const hrefPattern = (assets: string): RegExp =>
	// eslint-disable-next-line security/detect-non-literal-regexp -- the folder name is escaped
	new RegExp(
		String.raw`\bhref=["']?(\/${RegExp.escape(assets)}\/[^"'\s>]+\.css)`,
		'i',
	);

/**
 * Inlines a page's own style sheets, in place, so the cascade order holds.
 * @param html - A built HTML document.
 * @param readCss - Returns the CSS of a `/_astro/…` path.
 * @param assets - Astro's `build.assets` folder name.
 * @returns The new HTML and the paths it inlined.
 */
export const inlineStylesheets = (
	html: string,
	readCss: (href: string) => string,
	assets = '_astro',
): { html: string; inlined: string[] } => {
	const inlined: string[] = [];
	const pattern = hrefPattern(assets);
	const result = html.replaceAll(LINK_PATTERN, (link) => {
		const href = pattern.exec(link)?.[1];

		if (!href || !STYLESHEET_PATTERN.test(link)) {
			return link;
		}

		const css = readCss(href);

		// "</style" in a string or comment would end the element early.
		if (/<\/style/i.test(css)) {
			throw new Error(`${href} contains "</style", can't inline it`);
		}

		inlined.push(href);

		// A function result, so a `$` in the CSS is never read as a pattern.
		return `<style>${css}</style>`;
	});

	return { html: result, inlined };
};

export interface InlineCssOptions {
	/** HTML files to leave alone, as globs. Default: Partytown's sandbox page. */
	exclude?: string[];
}

/**
 * Inlines every page's style sheets and deletes the files.
 * @param context - The build output, assets folder and logger.
 * @param options - Pages to skip.
 */
export const inlineCss = (
	{ dir, assets = '_astro', logger = consoleLogger }: StepContext,
	{ exclude = ['~partytown/**'] }: InlineCssOptions = {},
): void => {
	const htmlFiles = filesIn(dir, '**/*.html', exclude);
	const readCss = (href: string): string =>
		fs.readFileSync(path.join(dir, href), 'utf8').trim();
	const inlinedFiles = new Set<string>();

	for (const file of htmlFiles) {
		const { html, inlined } = inlineStylesheets(
			fs.readFileSync(file, 'utf8'),
			readCss,
			assets,
		);

		if (inlined.length > 0) {
			fs.writeFileSync(file, html);
		}

		for (const href of inlined) {
			inlinedFiles.add(href);
		}
	}

	// Every page now carries its CSS, so the files are never requested.
	for (const href of inlinedFiles) {
		fs.rmSync(path.join(dir, href));
	}

	logger.info(
		`🎨 ${inlinedFiles.size} style sheets inlined into ${htmlFiles.length} pages`,
	);
};
