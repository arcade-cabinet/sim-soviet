# Game Status

Report the current overall status of the SimSoviet 1917 project — version, test health, recent activity, and open work.

## Steps

1. Get the current version from package.json:
   ```bash
   node -e "console.log(require('./package.json').version)"
   ```

2. Run the test suite and report results:
   ```bash
   npm test -- --silent 2>&1 | tail -10
   ```

3. Show recent commit history:
   ```bash
   git log --oneline -10
   ```

4. Show current branch and status:
   ```bash
   git branch --show-current
   git status --short
   ```

5. List open pull requests:
   ```bash
   gh pr list 2>/dev/null || echo "gh CLI not available or not authenticated"
   ```

6. List open issues (if any):
   ```bash
   gh issue list --limit 5 2>/dev/null || echo "gh CLI not available or not authenticated"
   ```

7. Count source files by category:
   ```bash
   echo "Engine files: $(find src/engine -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)"
   echo "Game files: $(find src/game -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)"
   echo "ECS files: $(find src/ecs -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)"
   echo "Scene files: $(find src/scene -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)"
   echo "UI files: $(find src/ui -name '*.ts' -o -name '*.tsx' 2>/dev/null | wc -l)"
   echo "Test files: $(find __tests__ -name '*.test.*' 2>/dev/null | wc -l)"
   ```

8. Present a formatted status report:
   ```
   ## SimSoviet 1917 — Project Status

   **Version**: X.Y.Z
   **Branch**: current-branch
   **Tests**: X suites, Y tests (pass/fail)

   ### Recent Commits
   - ...

   ### Open PRs
   - ...

   ### Source File Counts
   - Engine: X
   - Game: X
   - ECS: X
   - Scene: X
   - UI: X
   - Tests: X
   ```
