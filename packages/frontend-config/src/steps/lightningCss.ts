/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: minifies every CSS file and lowers it to the project's
 * browserslist targets.
 */
import fs from 'node:fs';
import path from 'node:path';

import browserslist from 'browserslist';
import { browserslistToTargets, transform } from 'lightningcss';

import {
	consoleLogger,
	failIfAny,
	filesIn,
	messageOf,
	type StepContext,
	toKb,
	totalSizeOf,
} from './shared.ts';

export interface LightningCssOptions {
	/**
	 * Where to read the browserslist config from (the `browserslist` field of
	 * package.json). Default: the current folder, the project root in a build.
	 */
	root?: string;
}

/**
 * Minifies every CSS file of the build, in place.
 * @param context - The build output and logger.
 * @param options - Where the browserslist config is.
 */
export const lightningCss = (
	{ dir, logger = consoleLogger }: StepContext,
	{ root = process.cwd() }: LightningCssOptions = {},
): void => {
	const cssFiles = filesIn(dir, '**/*.css');

	if (cssFiles.length === 0) {
		logger.warn('⚠️ LightningCSS: no CSS files in the build');

		return;
	}

	const targets = browserslistToTargets(
		browserslist(undefined, { path: root }),
	);
	const before = totalSizeOf(cssFiles);
	const failures: string[] = [];

	for (const file of cssFiles) {
		const name = path.relative(dir, file);

		try {
			const result = transform({
				filename: file,
				code: fs.readFileSync(file),
				minify: true,
				targets,
			});

			// Rules it couldn't parse or lower are dropped or kept as written:
			// show them instead of shipping the surprise.
			for (const warning of result.warnings) {
				logger.warn(
					`⚠️ ${name}:${warning.loc.line}:${warning.loc.column} ${warning.message}`,
				);
			}

			fs.writeFileSync(file, result.code);
		} catch (error) {
			failures.push(`${name}: ${messageOf(error)}`);
		}
	}

	failIfAny('LightningCSS', failures);

	logger.info(
		`⚡ LightningCSS: ${cssFiles.length} style sheets, ${toKb(before)} → ${toKb(totalSizeOf(cssFiles))}`,
	);
};
