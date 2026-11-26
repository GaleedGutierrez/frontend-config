import { describe, expect, it } from 'vitest';

import {
	applyPolicy,
	buildPartytownPolicy,
	buildPolicy,
	hashSource,
	inlineScripts,
	inlineStyles,
	PARTYTOWN_MARKER,
	REPORT_ONLY_HEADER,
} from '../src/steps/csp.ts';

/**
 * Splits a policy into its directives.
 * @param policy - A header value.
 * @returns Directive name → its sources.
 */
const parse = (policy: string): Map<string, string[]> =>
	new Map(
		policy.split('; ').map((directive) => {
			const [name = '', ...sources] = directive.split(' ');

			return [name, sources];
		}),
	);

describe('inlineScripts', () => {
	it('keeps classic and module scripts, quoted or not', () => {
		const html = [
			'<script>a()</script>',
			'<script type="module">b()</script>',
			'<script type=module>c()</script>',
			"<script type='text/javascript'>d()</script>",
		].join('');

		expect(inlineScripts(html)).toStrictEqual(['a()', 'b()', 'c()', 'd()']);
	});

	it('skips external scripts and data blocks', () => {
		const html = [
			'<script type="module" src="/_astro/a.js"></script>',
			'<script defer src="https://example.com/x.js" type="text/partytown"></script>',
			'<script type="application/ld+json">{"@type":"Person"}</script>',
			'<script type="text/partytown">gtag()</script>',
		].join('');

		expect(inlineScripts(html)).toStrictEqual([]);
	});

	it('keeps the exact text, whitespace included, so the hash matches', () => {
		expect(inlineScripts('<script>\n\ta();\n</script>')).toStrictEqual([
			'\n\ta();\n',
		]);
	});
});

describe('inlineStyles', () => {
	it('keeps every <style> element, attributes or not', () => {
		const html =
			'<style>a{color:red}</style><link rel="stylesheet" href="/x.css"><style media="print">b{}</style>';

		expect(inlineStyles(html)).toStrictEqual(['a{color:red}', 'b{}']);
	});
});

describe('hashSource', () => {
	it('is the base64 SHA-256 of the text, quoted as a CSP source', () => {
		expect(hashSource('alert(1)')).toBe(
			"'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='",
		);
	});
});

describe('buildPolicy', () => {
	const hash = hashSource('a()');
	const styleHash = hashSource('a{}');
	const policy = buildPolicy(
		{ scripts: [hash], styles: [styleHash] },
		{
			'script-src': ['https://cdn.example'],
			'img-src': ['https://img.example'],
		},
	);
	const directives = parse(policy);

	it('allows inline scripts and styles only by hash, then the extra sources', () => {
		expect(directives.get('script-src')).toStrictEqual([
			"'self'",
			hash,
			'https://cdn.example',
		]);
		expect(directives.get('style-src')).toStrictEqual([
			"'self'",
			styleHash,
		]);
		expect(directives.get('img-src')).toStrictEqual([
			"'self'",
			'https://img.example',
		]);
		expect(policy).not.toContain("'unsafe-inline'");
		expect(policy).not.toContain("'unsafe-eval'");
	});

	it('locks down plugins, base URLs, forms and framing', () => {
		expect(directives.get('object-src')).toStrictEqual(["'none'"]);
		expect(directives.get('base-uri')).toStrictEqual(["'none'"]);
		expect(directives.get('form-action')).toStrictEqual(["'none'"]);
		expect(directives.get('frame-ancestors')).toStrictEqual(["'none'"]);
	});

	it('falls back to same-origin only', () => {
		expect(directives.get('default-src')).toStrictEqual(["'self'"]);
	});

	it('adds an optional directive only when it has sources', () => {
		expect(directives.has('media-src')).toBe(false);
		expect(
			parse(
				buildPolicy(
					{ scripts: [], styles: [] },
					{ 'media-src': ['https://video.example'] },
				),
			).get('media-src'),
		).toStrictEqual(['https://video.example']);
	});

	it.each(["'unsafe-inline'", "'unsafe-eval'"])(
		'rejects %s in the page policy',
		(source) => {
			expect(() =>
				buildPolicy(
					{ scripts: [], styles: [] },
					{ 'script-src': [source] },
				),
			).toThrow(/hash the inline code/);
		},
	);
});

describe('buildPartytownPolicy', () => {
	const directives = parse(
		buildPartytownPolicy({ 'script-src': ['https://tag.example'] }),
	);

	it("keeps the eval and inline exceptions to Partytown's policy", () => {
		expect(directives.get('script-src')).toStrictEqual([
			"'self'",
			"'unsafe-inline'",
			"'unsafe-eval'",
			'blob:',
			'https://tag.example',
		]);
		expect(directives.get('worker-src')).toStrictEqual(["'self'", 'blob:']);
		// The page frames the sandbox; no other site may.
		expect(directives.get('frame-ancestors')).toStrictEqual(["'self'"]);
		expect(directives.get('object-src')).toStrictEqual(["'none'"]);
	});
});

describe('applyPolicy', () => {
	const header = REPORT_ONLY_HEADER;
	const headers = [
		'/*',
		'  Strict-Transport-Security: max-age=31536000',
		'',
		'/_astro/*',
		'  Cache-Control: immutable',
		'',
	].join('\n');
	const partytownPolicy = buildPartytownPolicy();
	const result = applyPolicy(headers, {
		header,
		policy: "default-src 'self'",
		partytownPolicy,
	});
	const lines = result.split('\n');

	it('adds the header to the existing /* rule, never a second one', () => {
		// A second /* rule replaces the first on Cloudflare, dropping HSTS.
		expect(lines.filter((line) => line === '/*')).toHaveLength(1);
		expect(lines.slice(0, 3)).toStrictEqual([
			'/*',
			`  ${header}: default-src 'self'`,
			'  Strict-Transport-Security: max-age=31536000',
		]);
	});

	it("gives Partytown's files their own CSP and framing, after the /* rule", () => {
		const rule = lines.indexOf('/~partytown/*');

		expect(rule).toBeGreaterThan(lines.indexOf('/*'));
		// Cloudflare joins matching rules: each /* value is detached first, so
		// the page's CSP and X-Frame-Options: DENY never reach the sandbox.
		expect(lines.slice(rule + 1)).toStrictEqual([
			`  ! ${header}`,
			`  ${header}: ${partytownPolicy}`,
			'  ! X-Frame-Options',
			'  X-Frame-Options: SAMEORIGIN',
			'',
		]);
	});

	it('leaves the Partytown rule out when the site has no Partytown', () => {
		const withoutPartytown = applyPolicy(headers, {
			header,
			policy: "default-src 'self'",
		});

		expect(withoutPartytown).not.toContain(PARTYTOWN_MARKER);
		expect(withoutPartytown).not.toContain('/~partytown/*');
	});

	it('gives the same file when applied twice', () => {
		expect(
			applyPolicy(result, {
				header,
				policy: "default-src 'self'",
				partytownPolicy,
			}),
		).toBe(result);
	});

	it('replaces a report-only header when the policy is enforced', () => {
		const enforced = applyPolicy(result, {
			header: 'Content-Security-Policy',
			policy: "default-src 'self'",
		});

		expect(enforced).not.toContain(REPORT_ONLY_HEADER);
		expect(enforced).toContain(
			"  Content-Security-Policy: default-src 'self'",
		);
	});

	it('creates the /* rule when the file has none', () => {
		expect(
			applyPolicy('', { header, policy: "default-src 'self'" })
				.split('\n')
				.slice(0, 2),
		).toStrictEqual(['/*', `  ${header}: default-src 'self'`]);
	});

	it('rejects a line longer than Cloudflare allows', () => {
		expect(() =>
			applyPolicy(headers, { header, policy: 'a'.repeat(2000) }),
		).toThrow(/2000/);
	});
});
