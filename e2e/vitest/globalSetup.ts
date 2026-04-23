import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const artifactDirs = [
  'e2e/artifacts/vitest-historical/latest',
  'e2e/artifacts/vitest-browser/screenshots',
  'e2e/artifacts/vitest-browser/traces',
];

export default function globalSetup(): void {
  const root = resolve(__dirname, '../..');
  for (const dir of artifactDirs) {
    const abs = resolve(root, dir);
    rmSync(abs, { force: true, recursive: true });
    mkdirSync(abs, { recursive: true });
  }
}
