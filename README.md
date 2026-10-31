# Kiro Spec Progress

A tiny VS Code / Kiro extension that reads `.kiro/specs/*/tasks.md`, counts checkboxes, and shows a progress bar per spec in its own sidebar tab (plus an overall % in the status bar).

- `- [x]` done, `- [ ]` todo, `- [-]` / `- [~]` in progress (counted as not done)
- `- [ ]* ...` optional tasks (toggle with `kiroSpecProgress.includeOptional`)
- Sub-tasks are counted too; set `kiroSpecProgress.topLevelOnly` to count only top-level tasks
- Checkboxes inside ``` code fences are ignored
- Click a spec to open its `tasks.md`. Updates live as you edit (even before saving).

## Install

```sh
kiro --install-extension kiro-spec-progress-0.1.0.vsix   # or: code --install-extension ...
```
Or: Extensions view → `...` → *Install from VSIX...*

## Hack on it

- `src/parse.js` — the counting logic (no VS Code deps). `npm test` runs `test/parse.test.js`.
- `src/extension.js` — scanning, file watching, the webview HTML/CSS.
- F5 launches an Extension Development Host on `test/fixtures` (sample specs).
- Rebuild the `.vsix`: `npm run build` (see below).

## Build & publish

One-time setup:

```sh
npm install                       # installs vsce locally (optional, npx fetches it otherwise)
npx vsce login digitaldefiance    # Azure DevOps PAT with Marketplace > Manage scope
```

| Command | What it does |
| --- | --- |
| `npm run build` | Runs the tests, then packages `dist/kiro-spec-progress-<version>.vsix` |
| `npm run publish` | Build, then publish that .vsix to the VS Code Marketplace |
| `npm run release:patch` / `release:minor` | Bump the version (commit + tag via `npm version`), then publish |

This extension is only on the VS Code Marketplace, not Open VSX. Kiro installs from Open VSX, so Kiro users should grab the `.vsix` (from a GitHub release or `npm run build`) and install it with `kiro --install-extension kiro-spec-progress-<version>.vsix`, or Extensions → `...` → *Install from VSIX...*

`package.json` has `"private": true` so a stray `npm publish` can't push this to the npm registry.
