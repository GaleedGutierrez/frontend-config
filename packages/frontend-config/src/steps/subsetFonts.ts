/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: subset every web font to the characters the built pages use.
 *
 * The page text is fixed at build time, so the glyphs it needs are known.
 * Runs after purgeCss, lightningCss and pruneCssVariables, because it renames
 * files: each subset font gets a content hash, and so does every CSS file
 * that points at a font, so a cached style sheet can never reference a font
 * that a later deploy removed.
 *
 * Before subsetting, it drops the `@font-face` rules (and their files) whose
 * `unicode-range` covers no character of the pages, and the WOFF fallbacks
 * (`fontFaces.ts`). It also pins the variable fonts in `pinnedAxes`.
 *
 * Text a client script inserts at runtime isn't in the HTML: add its
 * characters to `safetyCharacters`.
 */
import { createHash } from 'node:crypto';
import fs, { globSync } from 'node:fs';
import path from 'node:path';

import subsetFont from 'subset-font';

import { pruneFontFaces } from './fontFaces.ts';
import { consoleLogger, type StepContext } from './shared.ts';

export interface SubsetFontsOptions {
	/**
	 * Always kept, on top of the page text. Default: digits, Spanish letters
	 * and common punctuation, a small margin for text a future build adds.
	 */
	safetyCharacters?: string;
	/**
	 * Variable fonts used at a single instance, by file-name prefix, e.g.
	 * `{ 'jetbrains-mono-': { wght: 500 } }`: about half the bytes. Using the
	 * font at another weight then needs that weight here (or a range), or it
	 * renders at the pinned one.
	 */
	pinnedAxes?: Record<string, Record<string, number>>;
}

export const DEFAULT_SAFETY_CHARACTERS =
	' \u{A0}0123456789.,:;!?¿¡()[]-–—·…\'"“”‘’/#@&%+*=<>©áéíóúüñÁÉÍÓÚÜÑ';

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	apos: "'",
	gt: '>',
	lt: '<',
	nbsp: '\u{A0}',
	quot: '"',
};

const decodeEntities = (text: string): string =>
	text.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
		if (code.startsWith('#x') || code.startsWith('#X')) {
			return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
		}

		if (code.startsWith('#')) {
			return String.fromCodePoint(Number(code.slice(1)));
		}

		return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
	});

/** Visible text of an HTML document: no scripts, styles, comments or tags. */
const extractText = (html: string): string =>
	decodeEntities(
		html
			.replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
			.replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
			.replaceAll(/<!--[\s\S]*?-->/g, ' ')
			.replaceAll(/<[^>]+>/g, ' '),
	);

/** Strings in CSS `content` (pseudo-element text). */
const extractCssContent = (css: string): string =>
	css
		.matchAll(/content:\s*(["'])(.*?)\1/g)
		.map((match) =>
			(match[2] ?? '').replaceAll(
				/\\([\da-f]{1,6})\s?/gi,
				(_match, hex: string) =>
					String.fromCodePoint(Number.parseInt(hex, 16)),
			),
		)
		.toArray()
		.join('');

const hashOf = (content: Buffer | string): string =>
	createHash('sha256').update(content).digest('base64url').slice(0, 8);

/** "barlow-latin-400-normal.qiz4-Cze.woff2" → "barlow-latin-400-normal" */
const stemOf = (fileName: string): string =>
	fileName.replace(/\.[\w-]+\.(woff2|css)$/, '');

const toKb = (bytes: number): string => `${(bytes / 1024).toFixed(1)}kb`;

const collectCharacters = (
	htmlFiles: string[],
	cssFiles: string[],
	safetyCharacters: string,
): string => {
	let text = safetyCharacters;

	for (const file of htmlFiles) {
		text += extractText(fs.readFileSync(file, 'utf8'));
	}

	for (const file of cssFiles) {
		text += extractCssContent(fs.readFileSync(file, 'utf8'));
	}

	// text-transform can render either case of any letter.
	const characters = new Set(
		// eslint-disable-next-line @typescript-eslint/no-misused-spread -- fonts are subset by code point, which is what the spread yields
		[...text, ...text.toUpperCase(), ...text.toLowerCase()].filter(
			(character) => character !== '\n' && character !== '\t',
		),
	);

	return [...characters].join('');
};

/**
 * Replaces every `/<assets>/<old>` reference in the given files.
 * @param files - Files to rewrite.
 * @param renames - Old file name → new file name.
 * @param assets - The assets folder name.
 */
const rewriteReferences = (
	files: string[],
	renames: Map<string, string>,
	assets: string,
): void => {
	for (const file of files) {
		const before = fs.readFileSync(file, 'utf8');
		let after = before;

		for (const [oldName, newName] of renames) {
			after = after.replaceAll(
				`/${assets}/${oldName}`,
				// A function, so a `$` in the name is never read as a pattern.
				() => `/${assets}/${newName}`,
			);
		}

		if (after !== before) {
			fs.writeFileSync(file, after);
		}
	}
};

/**
 * Drops the dead `@font-face` rules and WOFF fallbacks from the style sheets,
 * then deletes the font files nothing references any more.
 * @param htmlFiles - Built pages (they preload fonts).
 * @param cssFiles - Built style sheets.
 * @param characters - Every character the pages use.
 * @param assets - The assets folder name.
 * @param assetsPath - Its absolute path.
 * @returns How many font files were deleted.
 */
const removeUnusedFontFaces = (
	htmlFiles: string[],
	cssFiles: string[],
	characters: string,
	assets: string,
	assetsPath: string,
): number => {
	let references = '';

	for (const file of cssFiles) {
		const before = fs.readFileSync(file, 'utf8');
		const after = pruneFontFaces(before, characters);

		if (after !== before) {
			fs.writeFileSync(file, after);
		}

		references += after;
	}

	for (const file of htmlFiles) {
		references += fs.readFileSync(file, 'utf8');
	}

	const unused = globSync('*.{woff,woff2}', { cwd: assetsPath }).filter(
		(file) => !references.includes(`/${assets}/${file}`),
	);

	for (const file of unused) {
		fs.rmSync(path.join(assetsPath, file));
	}

	return unused.length;
};

/**
 * Subsets the build's fonts and re-hashes the files that point at them.
 * @param context - The build output, assets folder and logger.
 * @param options - Characters to always keep, and axes to pin.
 */
export const subsetFonts = async (
	{ dir, assets = '_astro', logger = consoleLogger }: StepContext,
	{
		safetyCharacters = DEFAULT_SAFETY_CHARACTERS,
		pinnedAxes = {},
	}: SubsetFontsOptions = {},
): Promise<void> => {
	const assetsPath = path.join(dir, assets);
	const htmlFiles = globSync('**/*.html', { cwd: dir }).map((file) =>
		path.join(dir, file),
	);
	const cssFiles = (): string[] =>
		globSync('*.css', { cwd: assetsPath }).map((file) =>
			path.join(assetsPath, file),
		);
	const characters = collectCharacters(
		htmlFiles,
		cssFiles(),
		safetyCharacters,
	);

	// eslint-disable-next-line @typescript-eslint/no-misused-spread -- counts code points, like the subset
	logger.info(`🔤 ${[...characters].length} distinct characters kept`);

	const removedFonts = removeUnusedFontFaces(
		htmlFiles,
		cssFiles(),
		characters,
		assets,
		assetsPath,
	);

	if (removedFonts > 0) {
		logger.info(`   ${removedFonts} unused font files removed`);
	}

	const fontFiles = globSync('*.woff2', { cwd: assetsPath });

	if (fontFiles.length === 0) {
		logger.info(`   No fonts in ${assets}/, nothing to subset.`);

		return;
	}

	const results = await Promise.all(
		fontFiles.map(async (fontFile) => {
			const fontPath = path.join(assetsPath, fontFile);
			const original = fs.readFileSync(fontPath);
			// Other variable fonts keep their axes (subset-font's default).
			const variationAxes = Object.entries(pinnedAxes).find(([prefix]) =>
				fontFile.startsWith(prefix),
			)?.[1];
			const subset = await subsetFont(original, characters, {
				targetFormat: 'woff2',
				...(variationAxes && { variationAxes }),
			});
			const newName = `${stemOf(fontFile)}.${hashOf(subset)}.woff2`;

			fs.writeFileSync(path.join(assetsPath, newName), subset);

			if (newName !== fontFile) {
				fs.rmSync(fontPath);
			}

			return {
				fontFile,
				newName,
				before: original.length,
				after: subset.length,
			};
		}),
	);
	const fontRenames = new Map(
		results.map(({ fontFile, newName }) => [fontFile, newName]),
	);
	const beforeTotal = results.reduce((sum, { before }) => sum + before, 0);
	const afterTotal = results.reduce((sum, { after }) => sum + after, 0);

	// Fonts are referenced from the CSS (@font-face) and the HTML (preloads).
	rewriteReferences([...cssFiles(), ...htmlFiles], fontRenames, assets);

	// Re-hash the style sheets whose content just changed.
	const cssRenames = new Map<string, string>();

	for (const cssPath of cssFiles()) {
		const cssFile = path.basename(cssPath);
		const newName = `${stemOf(cssFile)}.${hashOf(fs.readFileSync(cssPath))}.css`;

		if (newName === cssFile) {
			continue;
		}

		fs.renameSync(cssPath, path.join(assetsPath, newName));
		cssRenames.set(cssFile, newName);
	}

	rewriteReferences(htmlFiles, cssRenames, assets);

	logger.info(
		`🔤 ${fontFiles.length} fonts: ${toKb(beforeTotal)} → ${toKb(afterTotal)} (all subsets, not only the ones a page downloads)`,
	);
};
