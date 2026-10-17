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


## V3: bulk uploads and private Railway bucket

The home screen now shows **Family Photos** directly below **My List** as a matching large card.
The photo page accepts multiple JPG, PNG and WebP files in a single selection. The browser uploads them one by one and shows progress. Each photo may be up to 20 MB. The server strips metadata via Sharp, auto-orients, limits the longest edge to 1920 px, and encodes WebP. New photos are stored in a **private Railway S3-compatible bucket**, not in SQLite. There is no fixed photo-count limit; storage costs and the hourly request limit still apply.

**Railway configuration:** Add a private Bucket to your project. In your app service variables, configure `S3_BUCKET`, `S3_ENDPOINT` (full HTTPS endpoint), `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` using the values from your bucket's credentials. Bucket and application must have compatible network access. Don't commit secrets to GitHub. Retain your existing SQLite `DATA_DIR` volume; the upgrade adds an optional `storage_key` column, and keeps old SQLite photos readable. **Back up SQLite and the bucket before major upgrades.** Existing V2 images stay in SQLite until optionally migrated; no automated destructive migration runs.

After deploying: sign in, test uploading two photos together, refresh, test photo display and deletion, and confirm another account can see the gallery. If the bucket is not configured, new uploads return a configuration error, but legacy photos still display.


## V4: independent photo collage

The background now shows up to 12 photos at once on desktop, or six on phones. Each tile independently transitions to another photo every roughly 7–14 seconds. Images are only loaded through the existing authenticated `/api/photos/:id/image` endpoint. Users with reduced-motion enabled see a stationary collage. No new dependencies or Railway environment settings are needed beyond V3.


## V5: AI Gift Finder
Add `OPENAI_API_KEY` to your Railway application service variables (never to public frontend files). Optional: `OPENAI_MODEL=gpt-5-mini` (choose a model enabled for Responses API web search). Redeploy. The Add Gift screen now offers a natural-language search with up to five options; choosing one only fills the editable gift form. The user must save the gift separately. Every search is authenticated, rate-limited to 12 per signed-in account per hour, and makes a paid OpenAI Responses API web search request. Retailer prices and links may be inaccurate; review each before saving. The header hand-wave emoji has been removed. No database schema change required.
