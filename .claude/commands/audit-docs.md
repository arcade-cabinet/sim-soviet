# Audit Docs

Scan all documentation files for frontmatter quality, accuracy, and completeness. Report a summary of documentation health.

## Steps

1. Find all markdown files in `docs/` and `memory-bank/` directories:
   ```bash
   find docs/ -name "*.md" -type f 2>/dev/null | sort
   find memory-bank/ -name "*.md" -type f 2>/dev/null | sort
   ```

2. For each markdown file, read the first 20 lines to check for YAML frontmatter (delimited by `---`):
   ```bash
   for f in $(find docs/ memory-bank/ -name "*.md" -type f 2>/dev/null | sort); do
     echo "=== $f ==="
     head -20 "$f"
     echo ""
   done
   ```

3. Count documents by status:
   - How many have frontmatter vs. missing frontmatter
   - Distribution of `status:` values (draft, implemented, planned, deprecated, etc.)
   - Distribution of `type:` values (design, spec, guide, reference, etc.)

4. For docs with `implements:` fields, verify the referenced source files exist:
   ```bash
   # Extract implements paths and check existence
   ```

5. For docs with `tests:` fields, verify the referenced test files exist.

6. Check for AGENTS.md index files and verify they list all docs in their directory.

7. Produce a structured report:
   ```
   ## Documentation Audit Report

   ### Summary
   - Total documents: X
   - With frontmatter: X
   - Missing frontmatter: X

   ### Status Distribution
   - implemented: X
   - draft: X
   - planned: X

   ### Issues Found
   1. [ISSUE TYPE] description

   ### Recommendations
   - ...
   ```

8. Flag any documents that need immediate attention (broken references, incorrect status, missing frontmatter on important docs).
