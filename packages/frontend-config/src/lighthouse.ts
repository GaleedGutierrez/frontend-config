/**
 * Lighthouse CI config, for a project's lighthouserc.cjs:
 * `module.exports = require('@galeedgutierrez/frontend-config/lighthouse').lighthouse({ … })`.
 *
 * Serves `dist/` and asserts every audit of `lighthouse:no-pwa`, the category
 * scores and the Core Web Vitals budgets. Each limit takes the median of the
 * runs: the default (the best run) let a 0.79 performance run pass.
 */
export interface LighthouseOptions {
	/** Pages to audit, under `http://localhost/`. Default: the home. */
	paths?: string[];
	/**
	 * Pages that must be indexable (SEO score and `is-crawlable`), as a
	 * regular expression on the URL. Default: the home. A `noindex` page
	 * (the 404) fails both, so it stays out.
	 */
	indexablePattern?: string;
	/** URL patterns to block, on top of Kaspersky's injected script. */
	blockedUrlPatterns?: string[];
	/** Minimum performance score (0–1). Default 0.9. */
	minPerformance?: number;
	/** Total page weight limit, in bytes. Default 500 KB. */
	maxBytes?: number;
}

/**
 * Builds the Lighthouse CI config.
 * @param options - Pages, blocked URLs and budgets.
 * @returns The `lighthouserc` object.
 */
export const lighthouse = ({
	paths = ['/'],
	indexablePattern = '/$',
	blockedUrlPatterns = [],
	minPerformance = 0.9,
	maxBytes = 500_000,
}: LighthouseOptions = {}): Record<string, unknown> => ({
	ci: {
		collect: {
			staticDistDir: './dist',
			url: paths.map((page) => new URL(page, 'http://localhost/').href),
			numberOfRuns: 3,
			settings: {
				// An antivirus web shield's injected script skews the scores.
				blockedUrlPatterns: [
					'*kaspersky-labs.com*',
					...blockedUrlPatterns,
				],
			},
		},
		assert: {
			assertMatrix: [
				{
					matchingUrlPattern: '.*',
					preset: 'lighthouse:no-pwa',
					aggregationMethod: 'median',
					assertions: {
						'categories:performance': [
							'error',
							{ minScore: minPerformance },
						],
						'categories:accessibility': ['error', { minScore: 1 }],
						'categories:best-practices': ['error', { minScore: 1 }],
						'largest-contentful-paint': [
							'error',
							{ maxNumericValue: 2500 },
						],
						'cumulative-layout-shift': [
							'error',
							{ maxNumericValue: 0.1 },
						],
						'total-blocking-time': [
							'error',
							{ maxNumericValue: 200 },
						],
						'total-byte-weight': [
							'error',
							{ maxNumericValue: maxBytes },
						],
						'is-crawlable': 'off',
					},
				},
				{
					matchingUrlPattern: indexablePattern,
					aggregationMethod: 'median',
					assertions: {
						'is-crawlable': ['error', { minScore: 1 }],
						'categories:seo': ['error', { minScore: 1 }],
					},
				},
			],
		},
		upload: {
			target: 'filesystem',
			outputDir: './lighthouse-report',
		},
	},
});

export default lighthouse;
