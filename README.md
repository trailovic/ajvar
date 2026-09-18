# Ajvar

A family recipe hub built with React, Vinext, Cloudflare Workers and D1.

## Features

- Sign in with a password or an eight-digit email code and choose a unique Ajvar username. Supabase manages authentication; Brevo delivers codes.
- Create kitchens and add existing Ajvar accounts by username or account email.
- Create and edit recipes with ingredient rows, ordered steps, meal course, cuisine, tags, cooking times, servings and an optional HTTPS photo URL.
- Keep recipes private, share with selected kitchens, or publish them to Home. Public recipes may also belong to selected kitchens.
- Kitchen shares persist across recipe edits until the author changes them. Saving privately removes all kitchen shares.
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

## Email configuration

Copy .env.example to .env.local for local auth settings. Set production runtime values through Sites. Supabase Site URL must be the Ajvar public URL. Enable custom SMTP using Brevo, keep email confirmation enabled, and use eight-digit OTPs with a 600-second expiration. Both signup and magic-link email templates must include {{ .Token }}. Browser sign-out ends this device session and clears private UI state.

## Password authentication development

The first step on `feat/password-auth` adds password login and registration to the account dialog. Password registration requires at least 12 characters in the form, then uses the existing email-code verification and username setup. Login accepts existing passwords without applying the new-registration minimum. Signup confirmation codes use Supabase's signup resend API; passwordless codes retain the existing OTP flow. Passwords are sent only to Supabase and are cleared from form state after successful authentication, signup, or switching methods. D1 profiles, identities, recipe ownership and kitchen membership are unchanged.

This is an incremental feature branch, not ready for release. Remaining steps:

- Add password setup/change for existing accounts with appropriate reauthentication.
- Add password recovery and deliberate recovery-session handling.
- Verify live Supabase email confirmation, eight-digit templates, SMTP delivery, rate limits and a server-side password minimum of at least 12 characters. The browser minimum is a usability check, not the security policy.
- Test both methods against the same real account, including account ownership, registration, resends, expired codes, recovery and logout before merging or deploying.

Until password management is added, existing code-only users should continue choosing **Email me a code instead**. Do not register again to add a password. Users who forget a password can still access their account with an email code.

## Verification

TypeScript validation and the production build pass. scripts/check-auth-identity.mjs checks identity migration, stable ownership and conflicting identities. scripts/check-auth-server.mjs checks that authentication fails closed for unverified/invalid identities. scripts/check-permissions.mjs exercises the built Worker on http://127.0.0.1:8788 with separate local test identities and no Supabase runtime bindings (legacy test mode). It verifies authorization, membership, persistent shares, revoked access, optimistic revision conflicts, search, time-of-day selection and cross-site write rejection. Run it only against this local preview; it creates disposable local data.

The browser flow was checked for profile creation, recipe-form saving, visible saved recipes, search and phone-sized layouts. Both WebMCP actions were checked through the browser’s tool interface, including expected failure paths.

## Photo credits

- Shakshuka: Toa Heftiba / Unsplash — https://unsplash.com/fr/photos/aliments-cuits-a-la-poele-gWkvURhoMlA
- Pasta: Fatemeh Rz / Unsplash — https://unsplash.com/photos/a-close-up-of-a-plate-of-food-with-pasta-iXzStLbERMk
- Roast chicken: Tim Douglas / Pexels — https://www.pexels.com/photo/delicious-roasted-chicken-with-assorted-vegetables-and-fruits-on-table-6210947/

These stock photographs illustrate serving inspiration. Uploaded photos are not part of this initial version; recipe authors can supply a photo URL.
