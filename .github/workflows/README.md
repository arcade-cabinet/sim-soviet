# GitHub Actions Workflows

This directory contains the CI/CD workflows for Sim Soviet.

## Workflows

### CI (`ci.yml`)

Runs on pull requests:

- **Core**: TypeScript, Biome, Jest, and static web export
- **Browser**: headed Chrome Vitest browser campaign proof under Xvfb
- **Smoke**: static export launch check with screenshots and diagnostics

### Release (`release.yml`)

Runs release-please on pushes to `main`; when a release is created it builds native artifacts:

- Android debug APK
- iOS simulator app

### CD (`cd.yml`)

Runs on pushes to `main`:

- Re-runs release checks
- Deploys the static site to GitHub Pages
- Uploads a debug Android APK artifact

### Automerge (`automerge.yml`)

Approves and squash-auto-merges Dependabot and release-please PRs.

## Setup Requirements

### GitHub Pages

To enable GitHub Pages deployment:

1. Go to repository Settings -> Pages
2. Set Source to "GitHub Actions"
3. The site will be available at `https://arcade-cabinet.github.io/sim-soviet/`

### Secrets

No secrets are required for basic CI/CD operation. The workflows use:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Local Development

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm web
```

Build for production:

```bash
pnpm build
```

Run linting:

```bash
pnpm lint
```

Run type checking:

```bash
pnpm typecheck
```

## Technology Stack

- **Node.js**: v22 (specified in `.nvmrc`)
- **Package Manager**: pnpm v10
- **Build Tool**: Expo web export
- **Rendering**: React Three Fiber + Three.js
- **Mobile**: Expo native projects
- **Code Quality**: Biome
- **Type Safety**: TypeScript 5.9
