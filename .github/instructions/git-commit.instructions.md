---
applyTo: "**"
---

# Commit Message Instructions

Only give me commit messages when you have modified files. Follow these rules for all commits, including releases.

## Rules

- Use present tense ("Add feature").
- Use imperative mood ("Move button").
- Keep the subject short (≤50 words).
- Reference issues/PRs with `#<number>` when provided.
- Message must be copy-paste ready for the terminal.

## Normal commit — output format

```bash
git commit -m "<Verb> <object>; <brief reason/impact>; refs #<number>"
```

### Examples

```bash
git commit -m "Add auth middleware; prevent unauthenticated access; refs #128"

git commit -m "Refactor video export pipeline; reduce stutter on rewind"
```
