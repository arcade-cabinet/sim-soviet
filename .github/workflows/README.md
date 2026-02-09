# GitHub Actions Workflows

This directory contains the CI/CD workflows for Sim Soviet.

## Workflows

### CI (`ci.yml`)

Runs on push to `main` and all pull requests:

- **Linting**: Uses Biome for code quality checks
- **Type checking**: TypeScript compilation without emit
- **Tests**: Runs the test suite with coverage
- **Build**: Builds the web application with Vite

### CD - Deploy (`deploy.yml`)

Runs after CI passes on `main`:

- Builds the web application
- Deploys to GitHub Pages

### Mobile CI (`mobile-ci.yml`)

Runs on push to `main` and pull requests that affect code:

- Sets up Android build environment (JDK 17)
- Builds web assets
- Syncs Capacitor
- Creates a debug Android APK
- Uploads the APK as an artifact (30-day retention)

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
pnpm dev
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
- **Build Tool**: Vite
- **Rendering**: Canvas 2D
- **Mobile**: Capacitor (Android/iOS support)
- **Code Quality**: Biome
- **Type Safety**: TypeScript 5.9
