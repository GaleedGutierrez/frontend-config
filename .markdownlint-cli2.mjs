import { markdownlint } from '@galeedgutierrez/frontend-config/markdownlint';

// Changesets writes the changelogs and the pending changes.
export default markdownlint({
	ignores: ['**/CHANGELOG.md', '.changeset/*.md'],
});
