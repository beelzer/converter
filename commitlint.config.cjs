// Conventional Commits config — see https://www.conventionalcommits.org/
//
// Enforced on PRs by .github/workflows/ci.yml (commitlint job).
// Past commits made before this was added are not retroactively validated.

module.exports = {
  extends: ['@commitlint/config-conventional'],
};
