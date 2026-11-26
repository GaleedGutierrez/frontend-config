/**
 * lint-staged config: fix, then format, each staged file.
 */
const config: Record<string, string | string[]> = {
	'*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,yml,yaml,astro}': [
		'eslint --fix',
		'prettier --write',
	],
	'*.css': ['stylelint --fix', 'prettier --write'],
	'*.{md,mdx}': [
		'markdownlint-cli2 --no-globs --fix',
		'textlint --fix',
		'prettier --write',
	],
	'*.jsonc': 'prettier --write',
};

export default config;
