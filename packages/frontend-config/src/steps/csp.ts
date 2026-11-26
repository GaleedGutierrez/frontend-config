/**
 * Content-Security-Policy for the built pages. Pure helpers, so the policy
 * and the hash extraction can be tested without a build; `cspHeaders.ts`
 * applies them to the build output.
 *
 * A static site can't use nonces: every inline script the browser executes
 * is allowed by the SHA-256 hash of its exact text, and so is every
 * `<style>` element.
 */
import { createHash } from 'node:crypto';

export type Directive =
	| 'default-src'
	| 'script-src'
	| 'style-src'
	| 'img-src'
	| 'font-src'
	| 'connect-src'
	| 'media-src'
	| 'frame-src'
	| 'worker-src'
	| 'manifest-src';

/** Extra sources per directive, appended after the shared ones. */
export type Sources = Partial<Record<Directive, string[]>>;

export const REPORT_ONLY_HEADER = 'Content-Security-Policy-Report-Only';
export const ENFORCED_HEADER = 'Content-Security-Policy';

// The page policy never allows these: an injected script would run too.
const FORBIDDEN_IN_PAGE = new Set(["'unsafe-inline'", "'unsafe-eval'"]);

// Types the browser executes. Anything else (`application/ld+json`,
// `text/partytown`) is a data block and is not subject to `script-src`.
const EXECUTABLE_TYPES = new Set([
	'',
	'module',
	'text/javascript',
	'application/javascript',
]);

const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SRC_PATTERN = /(?:^|\s)src\s*=/i;
const TYPE_PATTERN = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/**
 * Text of every inline script the browser would execute.
 * @param html - A built HTML document.
 * @returns The scripts' contents, in document order.
 */
export const inlineScripts = (html: string): string[] =>
	html
		.matchAll(SCRIPT_PATTERN)
		.filter(([, attributes = '']) => !SRC_PATTERN.test(attributes))
		.filter(([, attributes = '']) => {
			const match = TYPE_PATTERN.exec(attributes);
			const type = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
				.trim()
				.toLowerCase();

			return EXECUTABLE_TYPES.has(type);
		})
		.map((match) => match[2] ?? '')
		.toArray();

const STYLE_PATTERN = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * Text of every `<style>` element. Astro inlines small style sheets
 * (`inlineStylesheets: 'auto'`), and inlineCss inlines the rest.
 * @param html - A built HTML document.
 * @returns The style sheets' contents, in document order.
 */
export const inlineStyles = (html: string): string[] =>
	html
		.matchAll(STYLE_PATTERN)
		.map(([, content = '']) => content)
		.toArray();

/**
 * CSP source expression for one inline script or style sheet.
 * @param source - The element's exact text, as it appears in the HTML.
 * @returns `'sha256-…'`, quotes included.
 */
export const hashSource = (source: string): string =>
	`'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;

export interface PolicyHashes {
	/** Hash sources of the inline scripts. */
	scripts: string[];
	/** Hash sources of the `<style>` elements. */
	styles: string[];
}

/**
 * Looks up the extra sources of a directive.
 * @param sources - The project's extra sources.
 * @returns A lookup that gives `[]` for a directive without any.
 */
const extrasOf = (sources: Sources): ((directive: Directive) => string[]) => {
	const extras = new Map(Object.entries(sources));

	return (directive) => extras.get(directive) ?? [];
};

const serialize = (directives: string[][]): string =>
	directives.map((directive) => directive.join(' ')).join('; ');

/**
 * The page policy: same-origin only, plus the hashes and the project's
 * sources (analytics, a CDN…).
 * @param hashes - Hash sources of the inline scripts and style sheets.
 * @param sources - The project's extra sources.
 * @returns The header value.
 */
export const buildPolicy = (
	{ scripts, styles }: PolicyHashes,
	sources: Sources = {},
): string => {
	const forbidden = Object.values(sources)
		.flat()
		.filter((source) => FORBIDDEN_IN_PAGE.has(source));

	if (forbidden.length > 0) {
		throw new Error(
			`The page policy can't allow ${forbidden.join(', ')}: hash the inline code instead.`,
		);
	}

	const extra = extrasOf(sources);

	return serialize([
		['default-src', "'self'", ...extra('default-src')],
		['script-src', "'self'", ...scripts, ...extra('script-src')],
		['style-src', "'self'", ...styles, ...extra('style-src')],
		['img-src', "'self'", ...extra('img-src')],
		// Vite inlines font files under 4 KB into the CSS as data: URIs.
		['font-src', "'self'", 'data:', ...extra('font-src')],
		['connect-src', "'self'", ...extra('connect-src')],
		...(['media-src', 'frame-src', 'manifest-src'] as const)
			.filter((directive) => extra(directive).length > 0)
			.map((directive) => [directive, ...extra(directive)]),
		['worker-src', "'self'", ...extra('worker-src')],
		['object-src', "'none'"],
		['base-uri', "'none'"],
		['form-action', "'none'"],
		['frame-ancestors', "'none'"],
	]);
};

/**
 * Policy for Partytown's own files (`/~partytown/*`). Its sandbox page runs
 * an inline script, and its worker runs third-party scripts through `eval` /
 * `new Function` from a `blob:` URL, so this path needs what the page policy
 * forbids. The files are fixed vendor code from the build, so the exceptions
 * stay here and the rest still limits where they connect and who can frame
 * them.
 * @param sources - What the forwarded scripts load and call (e.g. Google
 * Analytics' origins in `script-src`, `img-src` and `connect-src`).
 * @returns The header value.
 */
export const buildPartytownPolicy = (sources: Sources = {}): string => {
	const extra = extrasOf(sources);

	return serialize([
		['default-src', "'self'"],
		[
			'script-src',
			"'self'",
			"'unsafe-inline'",
			"'unsafe-eval'",
			'blob:',
			...extra('script-src'),
		],
		['img-src', "'self'", ...extra('img-src')],
		['connect-src', "'self'", ...extra('connect-src')],
		['worker-src', "'self'", 'blob:'],
		['object-src', "'none'"],
		['base-uri', "'none'"],
		['form-action', "'none'"],
		// The page frames the sandbox; nobody else may.
		['frame-ancestors', "'self'"],
	]);
};

const WILDCARD_RULE = '/*';
const FRAME_OPTIONS_HEADER = 'X-Frame-Options';

export const PARTYTOWN_MARKER =
	"# Partytown's files get their own policy (@galeedgutierrez/frontend-config).";

// Cloudflare rejects longer lines in _headers.
const MAX_LINE_LENGTH = 2000;

export interface AppliedPolicies {
	/** The header name: enforced or report-only. */
	header: string;
	/** The page policy. */
	policy: string;
	/** Partytown's policy, when the site uses Partytown. */
	partytownPolicy?: string;
}

/**
 * Adds the policies to a Cloudflare `_headers` file.
 *
 * The page policy goes inside the existing `/*` rule: a second `/*` rule
 * replaces the first one on Cloudflare, which dropped the other security
 * headers.
 *
 * Partytown's rule comes last. Cloudflare joins every matching rule, so it
 * detaches the `/*` values it replaces before setting its own: a joined CSP
 * would be enforced on top of Partytown's and block its eval, and the page's
 * `X-Frame-Options: DENY` would forbid the page from framing the sandbox.
 * Applying it twice gives the same file.
 * @param headersFile - The `_headers` file as copied from `public/`.
 * @param policies - The header name and the policies.
 * @returns The file with the policies.
 */
export const applyPolicy = (
	headersFile: string,
	{ header, policy, partytownPolicy }: AppliedPolicies,
): string => {
	const policyLine = (value: string): string => {
		const line = `  ${header}: ${value}`;

		if (line.length > MAX_LINE_LENGTH) {
			throw new Error(
				`The CSP line is ${line.length} characters; Cloudflare allows ${MAX_LINE_LENGTH}.`,
			);
		}

		return line;
	};
	const markerIndex = headersFile.indexOf(PARTYTOWN_MARKER);
	const lines = (
		markerIndex === -1 ? headersFile : headersFile.slice(0, markerIndex)
	)
		.trimEnd()
		.split('\n')
		.filter(
			(line) =>
				!line.startsWith(`  ${REPORT_ONLY_HEADER}:`) &&
				!line.startsWith(`  ${ENFORCED_HEADER}:`),
		);
	const ruleIndex = lines.indexOf(WILDCARD_RULE);

	if (ruleIndex === -1) {
		lines.push('', WILDCARD_RULE, policyLine(policy));
	} else {
		lines.splice(ruleIndex + 1, 0, policyLine(policy));
	}

	const partytownRule =
		partytownPolicy === undefined
			? []
			: [
					'',
					PARTYTOWN_MARKER,
					'/~partytown/*',
					`  ! ${header}`,
					policyLine(partytownPolicy),
					`  ! ${FRAME_OPTIONS_HEADER}`,
					`  ${FRAME_OPTIONS_HEADER}: SAMEORIGIN`,
				];

	return [...lines, ...partytownRule, ''].join('\n').trimStart();
};
