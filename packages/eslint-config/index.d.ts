import type { Linter } from 'eslint';

export interface GaleedOptions {
	/**
	 * The project root, where its tsconfig.json lives. Pass
	 * `import.meta.dirname` from eslint.config.js.
	 */
	tsconfigRootDir: string;
	/**
	 * Extra glob patterns to ignore, on top of the build, test and agent
	 * folders the config already ignores.
	 */
	ignores?: string[];
}

/**
 * The shared flat config: JavaScript, TypeScript (type-checked), Astro, JSON,
 * YAML, Vitest (`tests/`) and Playwright (`tests/e2e/`).
 */
export declare const galeed: (options: GaleedOptions) => Linter.Config[];

export default galeed;
