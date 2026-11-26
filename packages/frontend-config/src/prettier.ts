/**
 * Prettier config. Indentation, print width and quotes come from the
 * project's .editorconfig (indent_style, indent_size, max_line_length,
 * quote_type), not from here.
 */
import { fileURLToPath } from 'node:url';

import type { Config } from 'prettier';

const config: Config = {
	// An absolute path: Prettier resolves plugin names from the project, where
	// this package's own dependencies may not be hoisted.
	plugins: [fileURLToPath(import.meta.resolve('prettier-plugin-astro'))],
	singleAttributePerLine: true,
	overrides: [
		{
			files: '*.jsonc',
			options: {
				trailingComma: 'none',
			},
		},
		{
			files: '*.md',
			options: {
				proseWrap: 'always',
			},
		},
	],
};

export default config;
