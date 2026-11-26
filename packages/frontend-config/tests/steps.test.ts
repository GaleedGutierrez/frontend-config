/* eslint-disable security/detect-non-literal-fs-filename -- test: every path is inside a temporary folder it creates */
/**
 * The post-build steps on a small fake build output, in the integration's
 * order (no fonts: subsetFonts needs real font files).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { hashSource, REPORT_ONLY_HEADER } from '../src/steps/csp.ts';
import { cspHeaders } from '../src/steps/cspHeaders.ts';
import { inlineCss } from '../src/steps/inlineCss.ts';
import { lightningCss } from '../src/steps/lightningCss.ts';
import { pruneCssVariables } from '../src/steps/pruneCssVars.ts';
import { purgeCss } from '../src/steps/purgeCss.ts';
import type { Logger } from '../src/steps/shared.ts';

const silent: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const PAGE = [
	'<!doctype html><html><head>',
	'<link rel="stylesheet" href="/_astro/index.abc.css">',
	'<script>document.documentElement.dataset.x = "1";</script>',
	'</head><body><main class="used grid-cols-[1fr_1px_1fr]"></main></body></html>',
].join('');

const CSS = [
	':root { --used: 1px; --unused: 2px; }',
	'.used { margin-inline: var(--used); }',
	String.raw`.grid-cols-\[1fr_1px_1fr\] { grid-template-columns: 1fr 1px 1fr; }`,
	'.unused { color: red; }',
	'.used:hover { opacity: 0.5; }',
].join('\n');

/**
 * Writes a fake build output to a temporary folder, deleted after the test.
 * @returns The folder.
 */
const fakeBuild = (): string => {
	const directory = fs.mkdtempSync(
		path.join(os.tmpdir(), 'frontend-config-'),
	);

	onTestFinished(() => {
		fs.rmSync(directory, { recursive: true, force: true });
	});
	fs.mkdirSync(path.join(directory, '_astro'));
	fs.writeFileSync(path.join(directory, 'index.html'), PAGE);
	fs.writeFileSync(path.join(directory, '_astro', 'index.abc.css'), CSS);
	fs.writeFileSync(
		path.join(directory, '_headers'),
		'/*\n  X-Frame-Options: DENY\n',
	);

	return directory;
};

describe('post-build steps', () => {
	it('purge, minify, prune, inline and hash the CSS', async () => {
		const directory = fakeBuild();
		const context = { dir: directory, logger: silent };
		const read = (file: string): string =>
			fs.readFileSync(path.join(directory, file), 'utf8');

		await purgeCss(context);
		lightningCss(context, { root: directory });
		pruneCssVariables(context);
		inlineCss(context);
		cspHeaders(context, {
			sources: { 'img-src': ['https://img.example'] },
		});

		const html = read('index.html');
		const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
		const headers = read('_headers');

		// purgeCss: unused selector gone, arbitrary value and :hover kept.
		expect(style).not.toContain('.unused');
		expect(style).toContain('1fr 1px 1fr');
		expect(style).toContain(':hover');
		// pruneCssVariables: the unread custom property is gone.
		expect(style).toContain('--used');
		expect(style).not.toContain('--unused');
		// inlineCss: the link became a <style>, and the file is deleted.
		expect(html).not.toContain('<link rel="stylesheet"');
		expect(
			fs.existsSync(path.join(directory, '_astro', 'index.abc.css')),
		).toBe(false);
		// cspHeaders: the final <style> and the inline script are hashed.
		expect(headers).toContain(
			`  ${REPORT_ONLY_HEADER}: default-src 'self'`,
		);
		expect(headers).toContain(hashSource(style));
		expect(headers).toContain(
			hashSource('document.documentElement.dataset.x = "1";'),
		);
		expect(headers).toContain("img-src 'self' https://img.example");
		expect(headers).toContain('X-Frame-Options: DENY');
	});

	it('fails the step when a style sheet is broken, after trying them all', () => {
		const directory = fakeBuild();

		fs.writeFileSync(
			path.join(directory, '_astro', 'broken.css'),
			'.a { color: }}}',
		);

		expect(() => {
			lightningCss(
				{ dir: directory, logger: silent },
				{ root: directory },
			);
		}).toThrow(/broken\.css/);
	});
});
