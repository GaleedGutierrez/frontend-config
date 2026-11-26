/**
 * textlint config (terminology), for a project's .textlintrc.cjs:
 * `module.exports = require('@galeedgutierrez/frontend-config/textlint').textlint()`.
 */
export interface TextlintOptions {
	/** Extra terms, written as they must appear (tool and brand names). */
	terms?: string[];
}

/** Tool names the docs mention, in their own spelling. */
const TERMS = [
	'Astro',
	'UnoCSS',
	'Partytown',
	'Cloudflare',
	'Lighthouse',
	'PurgeCSS',
	'Vitest',
	'Playwright',
];

// Default terms the docs don't follow.
const EXCLUDE = [
	'readme(s)?',
	String.raw`repo\b`,
	'anti[- ]pattern(s)?',
	String.raw`(?<=(?:\w+[^.?!])? )internet\b(?! explorer)`,
];

/**
 * Builds the textlint config.
 * @param options - Extra terms.
 * @returns The config object.
 */
export const textlint = ({ terms = [] }: TextlintOptions = {}): Record<
	string,
	unknown
> => ({
	filters: { comments: true },
	rules: {
		terminology: { terms: [...TERMS, ...terms], exclude: EXCLUDE },
	},
});

export default textlint;
