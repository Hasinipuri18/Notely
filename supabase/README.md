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

Notely signup asks for a username, email, password, and whether the account is for a student or faculty member. Supabase Auth verifies the email/password; the profile trigger stores the username and requested role in `profiles`. Every new account still receives the student role. A faculty signup is recorded as a request, and the project owner must verify and promote that account in the dashboard before faculty tools are available.

The existing browser-only accounts, notes, and files are not automatically migrated. The current app connects new account sign-in, notes, file uploads, saved notes, recently viewed history, and reminders to Supabase. Old testing accounts and uploads remain in the browser and will not appear in the backend library.

## Finish local setup

1. In Supabase, open **Connect** and copy the project's **publishable key** (often starts with `sb_publishable_`). Put it in `supabase-config.js` in place of `PASTE_YOUR_PUBLISHABLE_KEY_HERE`. The project URL is already filled in. Do not use or share a secret/service-role key.
2. In **SQL Editor**, run `migrations/002_add_uploader_name.sql` and `migrations/003_faculty_signup_requests.sql` once each, since the original schema was already applied.
3. Serve the site over local HTTP (for example, VS Code Live Server) instead of opening `index.html` as a `file://` URL. Set Supabase **Authentication → URL Configuration → Site URL** to that local address while testing (for example, `http://localhost:5500`). If email confirmation is enabled, make sure that local address is also an allowed redirect URL.
4. Create an account with a username, email, password, and account type. Sign-in uses email and password; the username is the name shown inside Notely. A faculty request appears as `requested_role = 'faculty'` in `profiles`; verify that person, then change `role` to `faculty` to enable faculty tools.

Email is used by Supabase Auth to verify the account and handle password sign-in. Notely does not display the email in the notes library. Email confirmation behavior is controlled by the project's Supabase Auth settings.
