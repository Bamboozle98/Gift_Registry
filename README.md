# Family Gifts — private 8-person gift registry PWA

A mobile-friendly, installable web app for **Mom, Dad, Brannon, Jackson, Kayla, Ben, Harper, and Callie**.

## Features
- Adults (Mom, Dad, Brannon, Jackson, Kayla, Ben) sign in using individual 6–12 digit PINs; Harper and Callie have no login.
- Adults edit their own wish lists; Kayla and Ben can also edit Harper and Callie’s lists.
- Browse everybody else's items and claim/release/mark purchased.
- A recipient NEVER receives claim status, buyer name, or buyer ID in responses for their own list.
- Claims are unique at the database level: two buyers cannot claim the same gift.
- Passwords are hashed using Argon2id; sessions are stored as SHA-256 hashes of random tokens.
- PWA with a home-screen icon; offline mode supports the app shell only, not gift data.

## Run locally
1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Run `npm run setup` and choose **unique** 6–12 digit PINs for the six adults. Do not use guessable PINs (birthdays, `123456`, etc.). The setup script writes only Argon2id PIN hashes to the SQLite database, never the original PINs.
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

## Version 2 changes (existing deployments)

- **Preserves the existing SQLite database** on startup. The server adds the `role` column if missing and marks Harper and Callie as child profiles. Existing gifts and claims are not deleted.
- **Do not run `npm run setup` during a normal update.** That command rotates adult PINs. It now only prompts for the six adult PINs if you intentionally need to set them again.
- Harper and Callie can no longer sign in, including through older cached pages/API sessions; they remain selectable as gift recipients. Both Kayla and Ben can add, edit, and remove gift entries for either child. All signed-in adults can see and claim gifts for the children.
- **Family photos** are stored as image bytes in the **same SQLite database**. Each signed-in adult can upload up to 2 MB per photo (JPG/PNG/WebP); 32 photos total. Only the person who uploaded a photo can remove it. Photos appear as a softly blurred rotating background after login. Since images are in SQLite, back up the database and size the persistent Railway volume appropriately. Consider resizing/compressing images before upload.
- **My List** is now a separate prominent card in the upper center of the family home screen.

### Deploy an update

1. Back up the deployed `gifts.sqlite` database, including any ongoing write activity (use SQLite's backup API or a paused app, not a naive copy of a live WAL database).
2. Replace the application source with this version and redeploy **without replacing or deleting the existing persistent database volume**.
3. Do **not** run setup again; the server automatically migrates child profiles at startup.
4. Refresh/relaunch the PWA after deployment. The service worker cache name was changed to refresh static assets.
5. Verify adult logins, both child lists, adding/editing a child's gift as Kayla or Ben, claim privacy for an adult, and photo upload/removal.

### Security/privacy notes

Photo image endpoints require an active signed-in session; family photos are not available publicly or on the login screen. Members should have consent to upload other family members' photographs, especially photos of children. There is no photo moderation or EXIF stripping in this version. Avoid uploading photos with sensitive locations or embedded metadata; strip metadata before uploading if necessary. This is a small private-family app, not a hardened public social network.
