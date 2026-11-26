/* eslint-disable camelcase -- markdownlint names its rule options in snake_case */
/**
 * markdownlint-cli2 config, for a project's .markdownlint-cli2.mjs:
 * `export default markdownlint()`.
 */
export interface MarkdownlintOptions {
	/** Extra globs to ignore, on top of the installed agent skills. */
	ignores?: string[];
	/** Rules to add or override (merged over the shared ones). */
	config?: Record<string, unknown>;
}

/**
 * Builds the markdownlint-cli2 options.
 * @param options - Extra ignores and rule overrides.
 * @returns The options object.
 */
export const markdownlint = ({
	ignores = [],
	config = {},
}: MarkdownlintOptions = {}): Record<string, unknown> => ({
	// The globs live here, not in the npm scripts: npm runs scripts with sh on
	// CI, which reads an unquoted ** as * and would lint one folder level only.
	globs: ['**/*.md'],
	// Skips dist/, node_modules/ and the rest git ignores.
	gitignore: true,
	ignores: ['.agents/**', '.claude/**', ...ignores],
	config: {
		MD003: { style: 'atx' },
		MD004: { style: 'dash' },
		// Prettier wraps prose at 80 columns. The default mode still allows a
		// line whose overflow has no spaces, like a long URL Prettier can't break.
		MD013: { headings: false, code_blocks: false },
		MD024: { siblings_only: true },
		MD029: { style: 'ordered' },
		MD035: { style: '---' },
		MD046: { style: 'fenced' },
		MD048: { style: 'backtick' },
		// The emphasis and strong markers Prettier writes.
		MD049: { style: 'underscore' },
		MD050: { style: 'asterisk' },
		...config,
	},
});

export default markdownlint;
