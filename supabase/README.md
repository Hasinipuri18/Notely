# Notely backend setup

This folder contains the first Supabase database schema for Notely. It creates the department's subjects and sections, user profiles, notes, note-to-section links, saved notes, recent views, upload reminders, row-level security policies, and a private Storage bucket for note files.

## Create the database

1. Create a Supabase project in the Supabase dashboard.
2. Open **SQL Editor** in that project.
3. Open `schema.sql`, copy its contents into a new SQL query, and run it once.
4. Confirm the `subjects`, `sections`, and app tables appear in Table Editor, and that the `notely-notes` Storage bucket is private.

The SQL is intended for a new Supabase project. It enables row-level security and gives signed-in students read access to notes, while faculty can add, edit, and delete only their own notes. New accounts default to the student role. Promote a verified faculty account manually in the dashboard before enabling its faculty tools.

## Connect Supabase Auth

The browser app loads the Supabase JavaScript client and `supabase-config.js`. Enter the project URL and publishable key in that config file. The publishable key is designed for browser use; never put a secret/service-role key in `app.js`, `supabase-config.js`, or any other browser file because it bypasses row-level security.

Because the initial schema was already run, also run `migrations/002_add_uploader_name.sql` once in SQL Editor. This adds the faculty display name stored with each upload. Do not rerun the full schema; it creates policies and triggers that are intended to be installed once.

Notely signup asks for a username, email, and password. Supabase Auth verifies the email/password; the profile trigger stores the username in `profiles`. If email confirmation is enabled, users must confirm their address before signing in. New accounts receive the student role. The project owner must promote verified faculty accounts in the dashboard.

The existing browser-only accounts, notes, and files are not automatically migrated. The current app connects new account sign-in, notes, file uploads, saved notes, recently viewed history, and reminders to Supabase. Old testing accounts and uploads remain in the browser and will not appear in the backend library.

## Finish local setup

1. In Supabase, open **Connect** and copy the project's **publishable key** (often starts with `sb_publishable_`). Put it in `supabase-config.js` in place of `PASTE_YOUR_PUBLISHABLE_KEY_HERE`. The project URL is already filled in. Do not use or share a secret/service-role key.
2. In **SQL Editor**, run `migrations/002_add_uploader_name.sql` once, since the original schema was already applied.
3. Serve the site over local HTTP (for example, VS Code Live Server) instead of opening `index.html` as a `file://` URL. Set Supabase **Authentication → URL Configuration → Site URL** to that local address while testing (for example, `http://localhost:5500`). If email confirmation is enabled, make sure that local address is also an allowed redirect URL.
4. Create a student account with a username, email, and password. Sign-in uses email and password; the username is the name shown inside Notely. New accounts are students by default. To test faculty tools, promote the intended account to `faculty` in the `profiles` table after it has registered.

Email is used by Supabase Auth to verify the account and handle password sign-in. Notely does not display the email in the notes library. Email confirmation behavior is controlled by the project's Supabase Auth settings.
