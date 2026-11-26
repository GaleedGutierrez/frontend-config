/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: removes the CSS selectors no built page or script uses.
 */
import fs from 'node:fs';
import path from 'node:path';

import { PurgeCSS, type UserDefinedOptions } from 'purgecss';

import {
	consoleLogger,
	failIfAny,
	filesIn,
	messageOf,
	type StepContext,
	toKb,
	totalSizeOf,
} from './shared.ts';

type SafelistPattern = string | RegExp;

export interface PurgeCssOptions {
	/**
	 * Selectors set at runtime, added to the shared safelist. PurgeCSS only
	 * sees the built HTML and JS, so an attribute a script sets needs an entry
	 * by attribute NAME (`/^data-theme/`, `'aria-current'`): patterns like
	 * `/^\[data-.*\]$/` or `/^@media/` match nothing.
	 */
	safelist?: {
		standard?: SafelistPattern[];
		deep?: RegExp[];
		greedy?: RegExp[];
	};
}

/** Selectors every project keeps: pseudo-classes, pseudo-elements, responsive prefixes. */
export const BASE_SAFELIST: { standard: SafelistPattern[]; deep: RegExp[] } = {
	standard: [
		'html',
		'body',
		'a',
		'a:hover',
		'a:focus-visible',
		'a:active',

		// Clases con prefijos responsivos (Tailwind-style)
		/^sm:/,
		/^md:/,
		/^lg:/,
		/^xl:/,
		/^2xl:/,

		// Pseudo-clases básicas
		/:hover$/,
		/:focus$/,
		/:focus-visible$/,
		/:focus-within$/,
		/:active$/,
		/:visited$/,
		/:link$/,
		/:target$/,
		/:enabled$/,
		/:disabled$/,
		/:checked$/,
		/:indeterminate$/,
		/:default$/,
		/:valid$/,
		/:invalid$/,
		/:in-range$/,
		/:out-of-range$/,
		/:required$/,
		/:optional$/,
		/:read-only$/,
		/:read-write$/,
		/:placeholder-shown$/,
		/:autofill$/,

		// Pseudo-clases estructurales
		/:root$/,
		/:empty$/,
		/:first-child$/,
		/:last-child$/,
		/:only-child$/,
		/:first-of-type$/,
		/:last-of-type$/,
		/:only-of-type$/,
		/:nth-child$/,
		/:nth-last-child$/,
		/:nth-of-type$/,
		/:nth-last-of-type$/,

		// Pseudo-clases funcionales modernas
		/:is$/,
		/:where$/,
		/:not$/,
		/:has$/,

		// Pseudo-clases de dirección
		/:dir\(ltr\)$/,
		/:dir\(rtl\)$/,
		/:lang$/,

		// Pseudo-clases de estado
		/:playing$/,
		/:paused$/,
		/:seeking$/,
		/:buffering$/,
		/:stalled$/,
		/:muted$/,
		/:volume-locked$/,
		/:fullscreen$/,
		/:picture-in-picture$/,

		// Pseudo-clases de modal
		/:modal$/,
		/:popover-open$/,

		// Pseudo-elementos
		/::before$/,
		/::after$/,
		/::first-line$/,
		/::first-letter$/,
		/::selection$/,
		/::backdrop$/,
		/::placeholder$/,
		/::marker$/,
		/::spelling-error$/,
		/::grammar-error$/,
		/::file-selector-button$/,
		/::part$/,
		/::slotted$/,
		/::view-transition$/,
		/::view-transition-group$/,
		/::view-transition-image-pair$/,
		/::view-transition-old$/,
		/::view-transition-new$/,
	],
	deep: [
		// Pseudo-clases básicas
		/:hover$/,
		/:focus$/,
		/:focus-visible$/,
		/:focus-within$/,
		/:active$/,
		/:visited$/,
		/:target$/,
		/:enabled$/,
		/:disabled$/,
		/:checked$/,
		/:indeterminate$/,
		/:valid$/,
		/:invalid$/,
		/:placeholder-shown$/,
		/:autofill$/,

		// Pseudo-clases estructurales
		/:empty$/,
		/:first-child$/,
		/:last-child$/,
		/:only-child$/,
		/:first-of-type$/,
		/:last-of-type$/,
		/:only-of-type$/,
		/:nth-child$/,
		/:nth-last-child$/,
		/:nth-of-type$/,
		/:nth-last-of-type$/,

		// Pseudo-clases funcionales modernas
		/:is$/,
		/:where$/,
		/:not$/,
		/:has$/,

		// Pseudo-elementos (con soporte para :: y :)
		/::?before$/,
		/::?after$/,
		/::?first-line$/,
		/::?first-letter$/,
		/::selection$/,
		/::backdrop$/,
		/::placeholder$/,
		/::marker$/,
		/::file-selector-button$/,
		/::part$/,
		/::slotted$/,

		// Clases responsivas
		/^sm:/,
		/^md:/,
		/^lg:/,
		/^xl:/,
		/^2xl:/,
	],
};

/**
 * The PurgeCSS options, minus the CSS and content.
 * @param safelist - The project's extra entries.
 * @returns The options.
 */
export const purgeCssOptions = (
	safelist: PurgeCssOptions['safelist'] = {},
): Omit<UserDefinedOptions, 'css' | 'content'> => ({
	// The default extractor splits on [ ] ( ) / , so UnoCSS arbitrary values
	// (grid-cols-[1fr_1px_1fr], aspect-[5/4]) never matched and were purged.
	// Same idea as Tailwind's extractor: any run of non-delimiters.
	defaultExtractor: (content) =>
		content.match(/[^\s"'`<>=]*[^\s"'`<>=:]/g) ?? [],
	safelist: {
		standard: [...BASE_SAFELIST.standard, ...(safelist.standard ?? [])],
		deep: [...BASE_SAFELIST.deep, ...(safelist.deep ?? [])],
		greedy: safelist.greedy ?? [],
	},
	keyframes: true,
	// false: it dropped a `local()` fallback face (e.g. "Barlow Fallback")
	// even though font-family uses it.
	fontFace: false,
	// false: it deleted tokens that CSS Modules use inside @media or nested
	// rules, so var() resolved to nothing (a sticky nav lost its z-index).
	// pruneCssVariables does this job across every sheet at once.
	variables: false,
});

/**
 * Purges every CSS file of the build, in place.
 * @param context - The build output and logger.
 * @param options - The project's safelist.
 */
export const purgeCss = async (
	{ dir, logger = consoleLogger }: StepContext,
	{ safelist }: PurgeCssOptions = {},
): Promise<void> => {
	const cssFiles = filesIn(dir, '**/*.css');

	if (cssFiles.length === 0) {
		logger.warn('⚠️ PurgeCSS: no CSS files in the build');

		return;
	}

	// Raw content, not globs: PurgeCSS 9 globs paths, and an absolute Windows
	// path (D:\…) matched nothing, so it purged nothing.
	const content = filesIn(dir, '**/*.{html,js}').map((file) => ({
		raw: fs.readFileSync(file, 'utf8'),
		extension: path.extname(file).slice(1),
	}));
	const options = purgeCssOptions(safelist);
	const before = totalSizeOf(cssFiles);
	const failures: string[] = [];

	await Promise.all(
		cssFiles.map(async (file) => {
			try {
				const [purged] = await new PurgeCSS().purge({
					...options,
					content,
					css: [{ raw: fs.readFileSync(file, 'utf8') }],
				});

				if (!purged) {
					throw new Error('PurgeCSS returned no result');
				}

				// No PostCSS pass after this: Vite already ran it, and
				// lightningcss minifies next. Re-running postcss-custom-properties
				// after lightningcss pinned every light-dark() color to light.
				fs.writeFileSync(file, purged.css);
			} catch (error) {
				failures.push(
					`${path.relative(dir, file)}: ${messageOf(error)}`,
				);
			}
		}),
	);

	failIfAny('PurgeCSS', failures);

	logger.info(
		`🧹 PurgeCSS: ${cssFiles.length} style sheets, ${toKb(before)} → ${toKb(totalSizeOf(cssFiles))}`,
	);
};
