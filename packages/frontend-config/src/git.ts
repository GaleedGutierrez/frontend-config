/**
 * Git dates for builds: the sitemap `lastmod` and a page's `dateModified`
 * should move when the content does, not on every deploy.
 */
import { execFileSync } from 'node:child_process';
import console from 'node:console';

/**
 * Runs git and returns its trimmed output.
 * @param gitArguments - The git arguments.
 * @returns The command's standard output.
 */
const git = (...gitArguments: string[]): string =>
	execFileSync('git', gitArguments, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	}).trim();

// Paths whose changes alter what the pages say: the source, the static files
// and the lockfile (content packages arrive as a version bump).
const CONTENT_PATHS = ['src', 'public', 'package-lock.json'];

/**
 * Date of the last commit that touched the content.
 * @param paths - The content paths. Default: `src`, `public` and the lockfile.
 * @returns The commit date, or the build time when git is unavailable.
 */
export const getLastModified = (paths: string[] = CONTENT_PATHS): Date => {
	try {
		const date = new Date(git('log', '-1', '--format=%cI', '--', ...paths));

		return Number.isNaN(date.getTime()) ? new Date() : date;
	} catch {
		return new Date();
	}
};

/**
 * Fetches the full history when the checkout is shallow. Cloudflare Pages
 * clones only the latest commit, and there that commit looks like it added
 * every file, so {@link getLastModified} returned it on every deploy.
 * Never throws: without git or network the dates fall back to the latest
 * commit (or the build time).
 */
export const fetchFullHistory = (): void => {
	try {
		if (git('rev-parse', '--is-shallow-repository') === 'true') {
			console.info(
				'📜 Shallow clone: fetching the full history for lastmod...',
			);
			git('fetch', '--unshallow', '--quiet');
		}
	} catch (error) {
		console.warn(
			`⚠️  Could not fetch the full git history: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};
