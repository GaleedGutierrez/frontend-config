/**
 * commitlint config: Conventional Commits.
 */
import { fileURLToPath } from 'node:url';

import type { UserConfig } from '@commitlint/types';

// calibreapp/image-actions commits the compressed images with a fixed message
// (no input changes it), which failed the PR's commitlint check.
const IMAGE_ACTIONS_COMMIT = 'Optimised images with calibre/image-actions';

const config: UserConfig = {
	// An absolute path: commitlint resolves `extends` from the project, where
	// this package's own dependencies may not be hoisted.
	extends: [
		fileURLToPath(import.meta.resolve('@commitlint/config-conventional')),
	],
	ignores: [(message): boolean => message.startsWith(IMAGE_ACTIONS_COMMIT)],
};

export default config;
