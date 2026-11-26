# Changesets

Each pull request that changes a published package adds a changeset:
`npm run changeset`, then pick the packages and the bump (patch, minor,
major) and describe the change for the changelog. The release workflow turns
the pending changesets into a "Version Packages" pull request; merging it
publishes the new versions to npm.
