# Check Coverage

Run the test suite with coverage reporting and summarize which files and functions lack coverage. Highlight any source files with 0% coverage.

## Steps

1. Run tests with coverage:
   ```bash
   npm test -- --coverage --silent 2>&1 | tail -50
   ```

2. If the coverage summary table is available, parse it and identify:
   - Files with 0% statement coverage (completely untested)
   - Files with less than 50% statement coverage (poorly tested)
   - Files with less than 50% branch coverage (missing edge cases)
   - Overall project coverage percentages

3. Check for specific high-priority uncovered areas:
   ```bash
   npm test -- --coverage --silent 2>&1 | grep -E "0 \|.*0 \||src/" | head -30
   ```

4. Present a formatted coverage report:
   ```
   ## Coverage Report

   ### Overall
   - Statements: X%
   - Branches: X%
   - Functions: X%
   - Lines: X%

   ### Uncovered Files (0% coverage)
   - src/path/to/file.ts

   ### Poorly Covered Files (<50%)
   - src/path/to/file.ts (statements: X%, branches: X%)

   ### Recommendations
   - Priority 1: Add tests for [critical uncovered file]
   - Priority 2: Improve branch coverage in [file]
   ```

5. If coverage report is not configured in jest.config, note this and suggest adding `collectCoverageFrom` to the Jest configuration to include all `src/` files.
