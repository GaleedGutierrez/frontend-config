/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: removes the custom properties nothing reads.
 *
 * `postcss-custom-properties` inlines the `:root` values it can resolve, but
 * leaves their declarations, and the design tokens declare more than the
 * page uses. A property is kept when a non-custom declaration, another kept
 * property, or any built page or script mentions it.
 *
 * All style sheets are read together: the tokens live in the layout's sheet
 * and the components' sheet uses them, so a per-file pass (like
 * postcss-prune-var) would delete tokens that are in use.
 *
 * Runs after lightningcss (its `light-dark()` polyfill adds properties) and
 * before subset-fonts, which hashes the final style sheets.
 */
import fs from 'node:fs';

import postcss, { type Declaration } from 'postcss';

import { consoleLogger, filesIn, type StepContext, toKb } from './shared.ts';

const CUSTOM_PROPERTY_PATTERN = /--[\w-]+/g;

const namesIn = (text: string): string[] =>
	text.match(CUSTOM_PROPERTY_PATTERN) ?? [];

/**
 * Drops every custom property declaration no one reads.
 * @param sheets - The built style sheets.
 * @param otherSources - The built HTML and JavaScript, which can set or read
 * properties at runtime (inline `style`, `setProperty`).
 * @returns The style sheets, in order, and the names removed.
 */
export const pruneCustomProperties = (
	sheets: string[],
	otherSources: string,
): { sheets: string[]; removed: string[] } => {
	const roots = sheets.map((sheet) => postcss.parse(sheet));
	const definitions = new Map<string, Declaration[]>();
	const pending = namesIn(otherSources);

	for (const root of roots) {
		root.walkDecls((declaration) => {
			if (declaration.prop.startsWith('--')) {
				const list = definitions.get(declaration.prop) ?? [];

				list.push(declaration);
				definitions.set(declaration.prop, list);

				return;
			}

			pending.push(...namesIn(declaration.value));
		});

		// At-rule preludes, e.g. @container style(--x: y).
		root.walkAtRules((rule) => {
			pending.push(...namesIn(rule.params));
		});
	}

	// A property read by a kept property is kept too.
	const used = new Set<string>();

	while (pending.length > 0) {
		const name = pending.pop() ?? '';

		if (used.has(name)) {
			continue;
		}

		used.add(name);

		const declarations = definitions.get(name) ?? [];

		pending.push(
			...declarations.flatMap((declaration) =>
				namesIn(declaration.value),
			),
		);
	}

	const removed = definitions
		.keys()
		.filter((name) => !used.has(name))
		.toArray();
	const unusedDeclarations = removed.flatMap(
		(name) => definitions.get(name) ?? [],
	);

	for (const declaration of unusedDeclarations) {
		const { parent } = declaration;

		declaration.remove();

		if (parent?.nodes.length === 0) {
			parent.remove();
		}
	}

	return { sheets: roots.map((root) => root.toString()), removed };
};

/**
 * Prunes the unused custom properties of every style sheet of the build.
 * @param context - The build output and logger.
 */
export const pruneCssVariables = ({
	dir,
	logger = consoleLogger,
}: StepContext): void => {
	const cssFiles = filesIn(dir, '**/*.css');
	const otherSources = filesIn(dir, '**/*.{html,js}')
		.map((file) => fs.readFileSync(file, 'utf8'))
		.join('\n');
	const before = cssFiles.map((file) => fs.readFileSync(file, 'utf8'));
	const { sheets, removed } = pruneCustomProperties(before, otherSources);
	let saved = 0;

	for (const [index, file] of cssFiles.entries()) {
		const original = before.at(index) ?? '';
		const pruned = sheets.at(index) ?? '';

		saved += original.length - pruned.length;

		if (pruned !== original) {
			fs.writeFileSync(file, pruned);
		}
	}

	logger.info(
		`✂️  ${removed.length} unused custom properties removed (${toKb(saved)})`,
	);
};
