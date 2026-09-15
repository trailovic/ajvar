# Ajvar

A family recipe hub built with React, Vinext, Cloudflare Workers and D1.

## Features

- Sign in with ChatGPT and choose a unique Ajvar username.
- Create kitchens and add existing Ajvar accounts by username or account email.
- Create and edit recipes with ingredient rows, ordered steps, meal course, cuisine, tags, cooking times, servings and an optional HTTPS photo URL.
- Keep recipes private, share with selected kitchens, or publish them to Home. Public recipes may also belong to selected kitchens.
- Kitchen shares persist across recipe edits until the author changes them. Saving privately removes all kitchen shares.
- Search permitted recipes by title, description, ingredients, cuisine and tags. Home prioritizes the meal course appropriate to the visitor’s local time.
- Three clearly credited starter recipes provide inspiration before family recipes are added.

## Account and access model

Sites owns authentication and injects verified identity headers. The application uses stable Site user IDs, not client-supplied identity or email, for ownership. Only the recipe author can edit a recipe or its sharing settings. Kitchen membership is checked on the server. Private responses are never cached.

Adding a member requires an existing Ajvar profile. All kitchen members may add another registered member. Adding someone does not send an email. Account email comes from ChatGPT sign-in and is only returned to its owner; usernames and display names appear to fellow kitchen members.

## Storage

D1 stores accounts, kitchens, members, recipes and recipe shares. Generated schema migrations live under drizzle/. Production data is independent of the local preview database. Local test accounts and recipes are never seeded into production.

## Development

Use Node 22.13 or later, the committed package-lock.json, and npm run dev. The portable preview supports a local-only simulated sign-in as Seedy. Production authentication always remains owned by Sites.

Generate migrations with npm run db:generate after changing db/schema.ts. Build with npm run build. Apply new local migrations through Wrangler using the built dist/server/wrangler.json configuration and .wrangler/state persistence directory.

## Verification

TypeScript validation and the production build pass. scripts/check-permissions.mjs exercises the built Worker on http://127.0.0.1:8788 with separate local test identities. It verifies authorization, membership, persistent shares, revoked access, optimistic revision conflicts, search, time-of-day selection and cross-site write rejection. Run it only against this local preview; it creates disposable local data.

The browser flow was checked for profile creation, recipe-form saving, visible saved recipes, search and phone-sized layouts. Both WebMCP actions were checked through the browser’s tool interface, including expected failure paths.

## Photo credits

- Shakshuka: Toa Heftiba / Unsplash — https://unsplash.com/fr/photos/aliments-cuits-a-la-poele-gWkvURhoMlA
- Pasta: Fatemeh Rz / Unsplash — https://unsplash.com/photos/a-close-up-of-a-plate-of-food-with-pasta-iXzStLbERMk
- Roast chicken: Tim Douglas / Pexels — https://www.pexels.com/photo/delicious-roasted-chicken-with-assorted-vegetables-and-fruits-on-table-6210947/

These stock photographs illustrate serving inspiration. Uploaded photos are not part of this initial version; recipe authors can supply a photo URL.