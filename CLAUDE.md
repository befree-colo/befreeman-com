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

## Everything outside the shell is a micro-frontend

The site's point is runtime composition of independently built remotes, and the `microfrontend-composition` spec requires it ("Content sections are remotes"). Any new page or section that presents career content MUST be a remote, never markup the shell renders on its own.

- **The shell owns only:** the header and navigation, the footer and contact path, the theme, the home page hero, routing, the not-found page, the architecture view, and the pre-rendered fallback markup inside each remote's slot.
- **A new content page means a new remote,** or a new route in an existing remote. It owns its prefix in `libs/page-templates/src/routes.ts`, is listed in `REMOTE_REGISTRY` (`libs/mfe-contract/src/registry.ts`) and the release tool's `PROJECT_ARTIFACTS`, mounts through `defineRemote`, and has a pre-rendered slot as its fallback.
- **Section labels belong to the section.** A section's eyebrow, heading and introduction are rendered by its remote, and the pre-rendered fallback keeps them inside the slot. Don't put them in shell markup around the slot.
- **When planning,** state which remote owns the change in the proposal and design. "A shell page with no remote" is not an acceptable option. If a change seems to need one, stop and ask.
