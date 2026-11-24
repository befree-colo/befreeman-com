# CLAUDE.md

## Jira keys on every branch, commit, and pull request

Work is tracked in Jira project `TODOS` (site gobefree.atlassian.net), under epic TODOS-6, with the `befreeman` label. Jira links code to an issue only when the issue key appears in the branch name, commit message, or pull request title, so every one of them MUST start with the key.

- **Branches:** `<KEY>-<short-kebab-description>`, e.g. `TODOS-59-deploy-from-github-actions`. No `fix/`, `docs/` or other prefix in front of the key.
- **Commits:** the subject line starts with the key and a space, e.g. `TODOS-59 Record the staging verification`. Every commit on the branch, including fixups and merge commits you write.
- **Pull requests:** the title starts with the key, e.g. `TODOS-59 Deploy from GitHub Actions`.

Which key to use:

- Use the most specific issue the change belongs to (a subtask over its story, a story over the epic).
- If no issue fits, find or create one before branching. Ask first if it isn't clear which story it belongs under.
- A change that spans several issues uses the main one in the branch name. Mention the others in the commit body.

Before committing, check `git branch --show-current` matches the convention. If a branch was created without a key, rename it before pushing (`git branch -m <KEY>-<description>`).
