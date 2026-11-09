---
name: ProseMirror dependency alignment
description: Avoid incompatible schema and DOM types when patching the slide editor's ProseMirror dependencies.
---

When upgrading ProseMirror view, align the deck's pinned model with the view's required model and check that the rest of the ProseMirror tree resolves a compatible shared copy.

**Why:** A security-patched view required a newer model with different DOM output types. Keeping the old direct model created incompatible Node/schema types across the slide editor, although each dependency installed successfully.

**How to apply:** Inspect the dependency tree and align model patch versions before treating these errors as application bugs. Do not modify the generated editor core or weaken types to accommodate mismatched package copies.
