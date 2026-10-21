---
name: Public demo and account preferences
description: Product constraints for the logged-out demo, display names, and personal API-key privacy.
---

The public demo must not persist investigations. Its account action should invite visitors to log in to save progress.

**Why:** The user explicitly wants visitors to preview the app without creating saved projects.

**How to apply:** Keep demo activity separate from authenticated saved investigations.

The editable in-app display name must remain independent of the sign-in username.

**Why:** The user explicitly distinguished an app nickname from login identity.

**How to apply:** Do not change authentication usernames when editing the account popup.

Personal API-key overrides are deliberately temporary and must not survive account changes.

**Why:** This avoids storing provider credentials in browser storage or leaking a key to the next signed-in account.

**How to apply:** Keep overrides in memory only unless a separate, explicitly approved encrypted credential-storage design is introduced.
