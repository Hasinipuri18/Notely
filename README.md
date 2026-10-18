# Notely

Notely is a second-year department notes library for students and faculty. It organizes uploaded notes by semester, section, subject, and unit or experiment.

## Features

- Student and faculty accounts with email/password authentication through Supabase Auth
- Separate student/faculty sign-in choice validated against each account's saved role
- Student browsing and search by semester, section, and subject
- Faculty uploads, search, edit, and confirmed deletion of notes
- Student previews, downloads, saved notes, and recently viewed notes
- Faculty upload reminders
- Supabase Database and private Storage for shared data and uploaded files

## Supabase setup

See [`supabase/README.md`](supabase/README.md) for the schema, migration, authentication, and local setup instructions. The browser app needs the project's Supabase URL and **publishable key** in `supabase-config.js`. Never put a Supabase secret/service-role key in browser code or this repository.

## Deploy with GitHub Pages

This project is a static site; the included GitHub Actions workflow publishes `index.html`, `app.js`, `styles.css`, and `supabase-config.js` from the `main` branch. After enabling Pages to use **GitHub Actions**, pushing to `main` deploys updates automatically.

For Supabase email confirmation on the deployed site, set **Authentication → URL Configuration → Site URL** to the final GitHub Pages URL, and add that URL to the allowed redirect URLs.

The Supabase publishable key is intended for browser use. Keep Row Level Security enabled and never commit secret/service-role keys.
