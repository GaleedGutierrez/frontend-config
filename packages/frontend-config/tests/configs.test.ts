/**
 * Each shared config, loaded by its own tool: a plugin or `extends` that
 * doesn't resolve fails here, not in a project.
 */
import lint from '@commitlint/lint';
import load from '@commitlint/load';
import type { LintOptions } from '@commitlint/types';
import * as prettier from 'prettier';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import commitlintConfig from '../src/commitlint.ts';
import { lighthouse } from '../src/lighthouse.ts';
import { markdownlint } from '../src/markdownlint.ts';
import { postcssConfig } from '../src/postcss.ts';
import prettierConfig from '../src/prettier.ts';
import stylelintConfig from '../src/stylelint.ts';
import { textlint } from '../src/textlint.ts';

describe('prettier', () => {
	it('formats .astro files with the plugin', async () => {
		const output = await prettier.format(
			'---\nconst a=1\n---\n<div class="a" id="b">{a}</div>\n',
			{ ...prettierConfig, filepath: 'page.astro', useTabs: true },
		);

		expect(output).toContain('const a = 1;');
		// singleAttributePerLine
		expect(output).toContain('<div\n\tclass="a"\n\tid="b"\n>');
	});
});

/**
 * Lints a commit message the way `commitlint --edit` does.
 * @param message - The commit message.
 * @returns Whether it passes.
 */
const isValidCommit = async (message: string): Promise<boolean> => {
	const {
		rules,
		parserPreset,
		ignores,
		defaultIgnores: hasDefaultIgnores,
	} = await load(commitlintConfig);
	const options: LintOptions = {
		parserOpts: parserPreset?.parserOpts as LintOptions['parserOpts'],
		ignores,
		defaultIgnores: hasDefaultIgnores,
	};
	const { valid: isValid } = await lint(message, rules, options);

	return isValid;
};

/**
 * Lints CSS with the shared stylelint config.
 * @param code - A style sheet.
 * @returns The rules it breaks.
 */
const lintCss = async (code: string): Promise<string[]> => {
	const { results } = await stylelint.lint({
		code,
		config: stylelintConfig,
	});

	return results.at(0)?.warnings.map(({ rule }) => rule) ?? [];
};

describe('commitlint', () => {
	it('accepts a Conventional Commit', async () => {
		await expect(isValidCommit('feat: adds the manifest')).resolves.toBe(
			true,
		);
	});

	it('rejects anything else', async () => {
		await expect(isValidCommit('Added the manifest')).resolves.toBe(false);
	});

	it("skips calibreapp/image-actions' fixed message", async () => {
		await expect(
			isValidCommit('Optimised images with calibre/image-actions'),
		).resolves.toBe(true);
	});
});

describe('stylelint', () => {
	it('accepts logical properties and oklch()', async () => {
		await expect(
			lintCss(
				'.a-button {\n\tinline-size: 100%;\n\tcolor: oklch(50% 0.1 200);\n}\n',
			),
		).resolves.toStrictEqual([]);
	});

	it('rejects physical properties, hex colors and !important', async () => {
		const rules = await lintCss(
			'.a-button {\n\twidth: 100%;\n\tcolor: #fff !important;\n}\n',
		);

		expect(rules).toContain('property-disallowed-list');
		expect(rules).toContain('color-no-hex');
		expect(rules).toContain('declaration-no-important');
	});

	it('never lets outline be removed', async () => {
		await expect(
			lintCss('.a-button:focus-visible {\n\toutline: none;\n}\n'),
		).resolves.toContain('declaration-property-value-disallowed-list');
	});
});

describe('postcss', () => {
	it('adds cssnano only in production builds', () => {
		const previous = process.env.NODE_ENV;

		process.env.NODE_ENV = 'development';

		const development = postcssConfig().plugins.length;

		process.env.NODE_ENV = 'production';

		const production = postcssConfig().plugins.length;

		process.env.NODE_ENV = previous;

		expect(production).toBe(development + 1);
	});
});

describe('option builders', () => {
	it('merge the project additions over the shared values', () => {
		expect(markdownlint({ ignores: ['x/**'] }).ignores).toStrictEqual([
			'.agents/**',
			'.claude/**',
			'x/**',
		]);
		expect(JSON.stringify(textlint({ terms: ['Sonda'] }))).toContain(
			'"Sonda"',
		);
		expect(
			JSON.stringify(lighthouse({ paths: ['/', '/404.html'] })),
		).toContain('"http://localhost/404.html"');
	});
});
