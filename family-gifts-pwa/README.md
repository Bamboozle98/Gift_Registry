# Family Gifts — private 8-person gift registry PWA

A mobile-friendly, installable web app for **Mom, Dad, Brannon, Jackson, Kayla, Ben, Harper, and Callie**.

## Features
- Select your family profile; sign in with an individual 6–12 digit PIN.
- Add, edit, and delete items only on your own wish list.
- Browse everybody else's items and claim/release/mark purchased.
- A recipient NEVER receives claim status, buyer name, or buyer ID in responses for their own list.
- Claims are unique at the database level: two buyers cannot claim the same gift.
- Passwords are hashed using Argon2id; sessions are stored as SHA-256 hashes of random tokens.
- PWA with a home-screen icon; offline mode supports the app shell only, not gift data.

## Run locally
1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Run `npm run setup` and choose **unique** 6–12 digit PINs for all eight people. Do not use guessable PINs (birthdays, `123456`, etc.). The setup script writes only Argon2id PIN hashes to the SQLite database, never the original PINs.
4. Run `npm start` and open `http://localhost:3000`.

**Important:** If you run setup again to rotate PINs, existing sessions remain valid. Delete existing sessions from the SQLite `sessions` table or restart with new database if you need to invalidate old sessions. Keep the SQLite database backed up.

## Put it online for the family
- Deploy this Node application to a hosting provider that supports a **persistent writable disk/volume** (for example, a VPS or Railway with a mounted volume). Do not use ephemeral SQLite storage.
- Set `NODE_ENV=production`, set `DATA_DIR` to the mounted persistent directory, and `TRUST_PROXY=1` **only** when behind one trusted reverse proxy.
- Make sure it is served over HTTPS; this is required for normal installable PWA behavior and secure session cookies on phones.
- Run `npm run setup` once with `DATA_DIR` pointed to the same persistent directory as the running server. Configure PINs privately on the host.
- Set up recurring **database backups** and restrict administrative access.
- Share the HTTPS URL with family. On iPhone: Safari → Share → Add to Home Screen. On Android: Chrome → menu → Install app/Add to Home screen.

## Sharing / privacy
You do **not** need to share the old Google Sheets files. This app uses its own private database. Only distribute the URL and each person's own PIN.

The main security limitation is that family-only PIN authentication is weaker than email or passkeys, especially if someone shares/guesses a PIN. A server-side 15 attempts/15 minutes auth limit helps but is not a substitute for strong credentials. Do not put payment information or sensitive personal details into gifts.

## Notes
- No hosted deployment was performed; this ZIP is runnable source code.
- Claim fields are never returned to the recipient; this is enforced by server SQL.
- When a gift owner deletes an item, its claim is deleted as well.
- The `/api/members` endpoint intentionally exposes first names only.
