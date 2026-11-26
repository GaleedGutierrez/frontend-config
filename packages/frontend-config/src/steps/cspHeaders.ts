/* eslint-disable security/detect-non-literal-fs-filename -- build step: every path comes from the build output, never from user input */
/**
 * Post-build: adds the Content-Security-Policy to the build's `_headers`
 * (Cloudflare Pages and Workers static assets).
 *
 * The hashes depend on the built HTML, so the header can't live in
 * `public/_headers`: it is generated here from every page's inline scripts
 * and `<style>` elements. Runs last, once the HTML is final. Re-running it
 * gives the same file.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
	applyPolicy,
	buildPartytownPolicy,
	buildPolicy,
	ENFORCED_HEADER,
	hashSource,
	inlineScripts,
	inlineStyles,
	REPORT_ONLY_HEADER,
	type Sources,
} from './csp.ts';
import { consoleLogger, filesIn, type StepContext } from './shared.ts';

export interface CspOptions {
	/**
	 * Only report violations (in the console), block nothing. Default true:
	 * check a new policy on a preview deploy before enforcing it.
	 */
	reportOnly?: boolean;
	/** Extra sources of the page policy (analytics, an edge-injected beacon…). */
	sources?: Sources;
	/**
	 * Partytown's own policy (`/~partytown/*`), with what the forwarded
	 * scripts load. Default false: the site doesn't use Partytown.
	 */
	partytown?: false | { sources?: Sources };
	/** The headers file, inside the build output. Default `_headers`. */
	headersFile?: string;
}

/**
 * Writes the policies into the build's headers file.
 * @param context - The build output and logger.
 * @param options - Mode and sources.
 */
export const cspHeaders = (
	{ dir, logger = consoleLogger }: StepContext,
	{
		reportOnly = true,
		sources = {},
		partytown = false,
		headersFile = '_headers',
	}: CspOptions = {},
): void => {
	// Partytown's sandbox page is vendor code with its own inline script; it
	// gets its own policy instead.
	const htmlFiles = filesIn(dir, '**/*.html', ['~partytown/**']);
	const scripts = new Set<string>();
	const styles = new Set<string>();

	for (const file of htmlFiles) {
		const html = fs.readFileSync(file, 'utf8');

		for (const script of inlineScripts(html)) {
			scripts.add(hashSource(script));
		}

		for (const style of inlineStyles(html)) {
			styles.add(hashSource(style));
		}
	}

	// Sorted, so the header only changes when a hash does.
	const sorted = (hashes: Set<string>): string[] =>
		[...hashes].toSorted((a, b) => a.localeCompare(b));
	const policy = buildPolicy(
		{ scripts: sorted(scripts), styles: sorted(styles) },
		sources,
	);
	const headersPath = path.join(dir, headersFile);
	const existing = fs.existsSync(headersPath)
		? fs.readFileSync(headersPath, 'utf8')
		: '';

	fs.writeFileSync(
		headersPath,
		applyPolicy(existing, {
			header: reportOnly ? REPORT_ONLY_HEADER : ENFORCED_HEADER,
			policy,
			...(partytown && {
				partytownPolicy: buildPartytownPolicy(partytown.sources),
			}),
		}),
	);

	logger.info(
		`🛡️  ${scripts.size} script and ${styles.size} style hashes from ${htmlFiles.length} pages`,
	);
};
