/**
 * stylelint never sees what UnoCSS generates. This generates a sample of
 * layout utilities and lints them with the shared stylelint rules about what
 * the CSS does (properties, colors, units, media queries, !important).
 * Formatting, order and naming rules are left out: generated CSS doesn't
 * follow them and nobody edits it.
 */
import stylelint from 'stylelint';
import { createGenerator } from 'unocss';
import { describe, expect, it } from 'vitest';

import stylelintConfig from '../src/stylelint.ts';
import { unoConfig } from '../src/unocss.ts';

const BEHAVIOR_RULES = new Set([
	'color-named',
	'color-no-hex',
	'declaration-no-important',
	'declaration-property-value-disallowed-list',
	'function-disallowed-list',
	'media-feature-range-notation',
	'property-disallowed-list',
	'unit-allowed-list',
	'unit-disallowed-list',
]);

const LAYOUT = [
	'flex',
	'grid',
	'gap-4',
	'px-4',
	'py-2',
	'pt-1',
	'pb-1',
	'mt-4',
	'mb-2',
	'mx-auto',
	'w-full',
	'w-1/2',
	'w-md',
	'w-[200px]',
	'h-full',
	'min-h-screen',
	'max-w-md',
	'top-0',
	'left-0',
	'inset-x-0',
	'scroll-mt-4',
	'aspect-[5/4]',
	'grid-cols-[1fr_1px_1fr]',
	'sm:flex',
	'md:grid-cols-2',
	'lg:hidden',
	'xl:px-8',
];

const BLOCKED = ['bg-red-500', 'text-lg', 'rounded', 'shadow', 'font-bold'];

const generate = async (
	tokens: string[],
	options?: Parameters<typeof unoConfig>[0],
): Promise<string> => {
	const generator = await createGenerator(unoConfig(options));
	const { css } = await generator.generate(tokens.join(' '), {
		preflights: false,
	});

	return css;
};

describe('unoConfig', () => {
	it('writes layout utilities that follow the shared stylelint rules', async () => {
		const css = await generate(LAYOUT);
		const rules = Object.fromEntries(
			Object.entries(stylelintConfig.rules ?? {}).filter(([name]) =>
				BEHAVIOR_RULES.has(name),
			),
		);
		const { results } = await stylelint.lint({
			code: css,
			config: { rules },
		});
		const warnings = results.at(0)?.warnings.map(({ text }) => text) ?? [];

		expect(css).not.toBe('');
		expect(warnings).toStrictEqual([]);
	});

	it('generates nothing for color, type, border, radius or shadow utilities', async () => {
		await expect(generate(BLOCKED)).resolves.toBe('');
	});

	it('generates nothing for the <h1>…<h6> tags', async () => {
		await expect(generate(['<h2>Title</h2>'])).resolves.not.toContain(
			'.h2',
		);
	});

	it('uses the given breakpoints, in range syntax', async () => {
		const css = await generate(['sm:flex'], {
			breakpoints: { sm: '30em' },
		});

		expect(css).toContain('@media (width >= 30em)');
	});

	it('keeps the physical output when logical is off', async () => {
		await expect(
			generate(['top-0'], { logical: false }),
		).resolves.toContain('top:0');
	});
});
