# Ajvar

A family recipe hub built with React, Vinext, Cloudflare Workers and D1.

## Features

- Sign in with a password or an eight-digit email code and choose a unique Ajvar username. Supabase manages authentication; Brevo delivers codes.
- Create kitchens and add existing Ajvar accounts by username or account email.
- Create and edit recipes with ingredient rows, ordered steps, meal course, cuisine, tags, cooking times, servings and an optional HTTPS photo URL.
- Keep recipes private, share with selected kitchens, or publish them to Home. Public recipes may also belong to selected kitchens.
- Kitchen shares persist across recipe edits until the author changes them. Saving privately removes all kitchen shares.
- Owners can enable an unlisted recipe link without changing visibility. Anyone with the link can read the recipe without an account; private recipes stay out of Home and public search.
- Search permitted recipes by title, description, ingredients, cuisine and tags. Home prioritizes the meal course appropriate to the visitor’s local time.
- Three clearly credited starter recipes provide inspiration before family recipes are added.

## Account and access model

The browser uses the Supabase client for email verification and session refresh. Each API request carries its access token; the Worker verifies it with Supabase getUser and requires a confirmed email. Identity mappings retain stable Ajvar profile IDs. On first verified email sign-in, an existing profile with the same email is linked once, preserving recipes and kitchens. A second Supabase identity cannot claim a previously linked profile. In email mode, platform identity headers are ignored. Only the recipe author can edit a recipe or its sharing settings. Kitchen membership is checked on the server. Private responses are never cached.

Adding a member requires an existing Ajvar profile. All kitchen members may add another registered member. Adding someone does not send an email. Account email comes from verified Supabase identity and is only returned to its owner; usernames and display names appear to fellow kitchen members.

## Storage

D1 stores accounts, external identity mappings, kitchens, members, recipes and recipe shares. Generated schema migrations live under drizzle/. Production data is independent of the local preview database. Local test accounts and recipes are never seeded into production.

## Development

Use Node 22.13 or later, the committed package-lock.json, and npm run dev. The portable preview supports a local-only simulated sign-in as Seedy. When SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are configured, email auth replaces the simulated/legacy login. The public runtime configuration endpoint exposes only the Supabase URL and publishable key. Never configure a Supabase secret/service-role key in this app. Store Brevo SMTP credentials only in Supabase Auth settings. Without both auth settings, the original Sites login remains as a deployment fallback.

Generate migrations with npm run db:generate after changing db/schema.ts. Build with npm run build. Apply new local migrations through Wrangler using the built dist/server/wrangler.json configuration and .wrangler/state persistence directory.

## Recipe share links

Open a saved recipe, choose **Share recipe → Enable share link → Copy link**. Only the author can enable, retrieve or disable the unlisted link. Sharing is off until explicitly enabled. A link gives read-only access to the current recipe (including future edits), not the author's account or kitchen. The API returns only cooking content and the author's display name. Recipients can forward the URL. Do not use links for information that must remain confidential to named recipients.

**Disable link** invalidates the URL on subsequent requests. Enabling sharing again creates a different, random 256-bit token; previous links stay invalid. Disabling cannot retract screenshots, downloaded content or a recipe already open on a recipient's screen. Changing visibility does not revoke an enabled unlisted link; use **Disable link** explicitly. Public recipes and starter recipes can also be shared by visitors; those public-only links stop working if a saved recipe is made private. Revoking an owner's unlisted link does not unpublish an otherwise public recipe.

Shared pages request `noindex`, `nofollow` and `noarchive` and use a no-referrer policy. These are crawler directives, not a guarantee that someone cannot republish the content. Recipe content comes from an uncached endpoint; the initial page HTML contains no private recipe content. No account is required by either the page or read endpoint. The hosting audience must also permit anonymous visitors; an externally private deployment still has its own sign-in gate. This branch does not change hosting access policies.

### Run and verify locally

Use Node 22.13+ and install with the existing lockfile. Build first to generate Wrangler's configuration, then apply the new **local-only** migration before starting development:

```bash
npm ci
npm run build
npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
npm run dev
```

Open the local address printed by the dev server (normally `http://localhost:5173`). Keep existing Supabase local settings if you already use them. Local data is separate from production; if needed, create a disposable local recipe. To test sharing:

1. Create a private recipe; enable its share link and copy it.
2. Paste it into a private/incognito window. Verify the recipe opens without signing in, including ingredient checkboxes.
3. Visit Home in that window and search for its title. It must not appear.
4. Edit the recipe as its author. Reload the link to see the updated content.
5. Disable the link and reload the incognito window. It must show “Recipe unavailable”.
6. Enable a new link. Confirm the new one works and the old one still fails.
7. Check a public recipe and a kitchen recipe too. Kitchen members cannot enable or retrieve the owner's unlisted link.

Run `node scripts/check-recipe-sharing.mjs` for isolated SQLite-backed route checks (no production credentials or data), and `npx tsc --noEmit` for type checking. Clipboard copying requires HTTPS or localhost; otherwise a selectable URL is shown for manual copying.

The additive `drizzle/0002_nifty_patch.sql` migration creates `recipe_links`; it does not alter recipes or their visibility. Apply this migration before deploying the new code. The Sites publishing flow applies committed migrations; deployments outside Sites must apply them through their existing D1 release workflow. Do not run local test/seed scripts against production.

## Email configuration

Copy .env.example to .env.local for local auth settings. Set production runtime values through Sites. Supabase Site URL must be the Ajvar public URL. Enable custom SMTP using Brevo, keep email confirmation enabled, and use eight-digit OTPs with a 600-second expiration. Both signup and magic-link email templates must include {{ .Token }}. Browser sign-out ends this device session and clears private UI state.

## Password authentication development

The `feat/password-auth` branch adds password login, registration, password settings and email-code recovery to the account dialog. Password registration requires at least 12 characters in the form, then uses the existing email-code verification and username setup. Login accepts existing passwords without applying the new-registration minimum. Signup confirmation codes use Supabase's signup resend API; passwordless codes retain the existing OTP flow. Passwords are sent only to Supabase and are cleared from form state after successful authentication, signup, or switching methods. D1 profiles, identities, recipe ownership and kitchen membership are unchanged.

This is an incremental feature branch, not ready for release. Remaining steps:

- Verify live Supabase email confirmation, eight-digit templates, SMTP delivery, rate limits and a server-side password minimum of at least 12 characters. The browser minimum is a usability check, not the security policy.
- Test both methods against the same real account, including account ownership, registration, resends, expired codes, recovery and logout before merging or deploying.

Existing users can sign in with either method, open **My account → Set or change password**, request a fresh eight-digit code, verify it, and enter their new password twice. Code-only users do not need to register again. Email-code login remains available after setting or changing a password.

Password settings use a separate, in-memory Supabase client with persistence and automatic refresh disabled. Code requests use `shouldCreateUser: false`. The verified Supabase subject and confirmed email must match the original account, and the current account is checked again before saving. Verification expires locally after ten minutes. After saving, the verified session transfers to the main client; cancelling revokes only the temporary session. A session-handoff failure is reported separately from a successful password save. No password or verification code is stored in D1, application logs or browser storage.

The app explicitly verifies an email OTP before allowing a password change through this UI. Also enable Supabase's **Secure password change / Require reauthentication** policy for provider-side protection; its built-in check exempts sessions created within the last 24 hours. This UI does not change that provider policy. Check whether **Require current password** is enabled: that additional policy requires a current-password input and is not implemented by this email-verification flow. These settings must be checked in the actual project before release.

Run `node scripts/check-password-change.mjs` for mocked-provider regression checks covering account binding, invalid codes, expiration, resends, password-policy failures, cancellation and session handoff. Live verification should cover both an existing code-only account and a password account: set/change the password, log out, log in with the new password, confirm the old password fails after a change, and confirm email-code login still opens the same recipes and kitchens.

## Password recovery

The login form includes **Forgot password?**. Recovery requests use Supabase `resetPasswordForEmail`, then verify the emailed eight-digit code with `type: 'recovery'`. No account is created by this flow. After verification, the user enters and confirms a new password, then returns to login with their email prefilled. The temporary recovery session is never adopted into the app's main client. It is revoked locally on completion or cancellation; the app does not replace another tab's active identity. Supabase's own session-revocation policy still applies when a password changes.

**Required Supabase setup before testing recovery:** in the project's authentication email templates, open **Reset password**. Set the subject to `Reset your Ajvar password`, and paste the body from [`supabase/templates/recovery.html`](supabase/templates/recovery.html). It must contain `{{ .Token }}`. The default link-only reset email will not work with this code-entry flow. Keep the existing eight-digit OTP length and 600-second expiry. This file is a template to copy into Supabase; committing it does not update the live dashboard.

Recovery deliberately uses code entry, so no callback route or automatic URL-session detection is needed. Keep `detectSessionInUrl: false`. Ordinary sign-in codes are not accepted as recovery codes. Unknown accounts receive the same on-screen request confirmation; invalid or expired codes cannot open the new-password form. A completed reset still succeeds if best-effort session cleanup fails.

Run `node scripts/check-password-recovery.mjs` for provider-mocked checks. For live verification: log out, choose **Forgot password?**, verify the actual recovery email's code, set a new password, return to login, and confirm the new password works while the old one fails. Also check invalid/expired codes, resend, cancellation, and that email-code login still opens the same recipes and kitchens. Try an unused email to confirm the UI does not reveal account existence. Never use another person's address for testing.

## Verification

TypeScript validation and the production build pass. scripts/check-auth-identity.mjs checks identity migration, stable ownership and conflicting identities. scripts/check-auth-server.mjs checks that authentication fails closed for unverified/invalid identities. scripts/check-permissions.mjs exercises the built Worker on http://127.0.0.1:8788 with separate local test identities and no Supabase runtime bindings (legacy test mode). It verifies authorization, membership, persistent shares, revoked access, optimistic revision conflicts, search, time-of-day selection and cross-site write rejection. Run it only against this local preview; it creates disposable local data.

The browser flow was checked for profile creation, recipe-form saving, visible saved recipes, search and phone-sized layouts. Both WebMCP actions were checked through the browser’s tool interface, including expected failure paths.

## Photo credits

- Shakshuka: Toa Heftiba / Unsplash — https://unsplash.com/fr/photos/aliments-cuits-a-la-poele-gWkvURhoMlA
- Pasta: Fatemeh Rz / Unsplash — https://unsplash.com/photos/a-close-up-of-a-plate-of-food-with-pasta-iXzStLbERMk
- Roast chicken: Tim Douglas / Pexels — https://www.pexels.com/photo/delicious-roasted-chicken-with-assorted-vegetables-and-fruits-on-table-6210947/

These stock photographs illustrate serving inspiration. Uploaded photos are not part of this initial version; recipe authors can supply a photo URL.
