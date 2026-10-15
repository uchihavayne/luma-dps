# Luma DPS community service

The service provides explicit encounter sharing and opt-in community rankings. Public reports contain aggregate player, skill and target totals. The desktop client never sends packet captures, Cube audio, preferences, unrelated encounters or deletion keys through a public response. Only an uploader's own name can be published; other players remain aliased.

`app/`, `lib/community.mjs`, its SQL tests, `db/schema.ts` and the migrations are identical to the reviewed managed service source. `SOURCE_FILES.json` records their byte counts and SHA-256 hashes. This directory uses a portable Cloudflare/Vinext build wrapper instead of the managed Site deployment wrapper. It contains no deployment credentials, managed authentication helpers or private preview runtime. Dependency versions remain locked to the managed build.

## Run the core tests

Node.js 22.13 or newer is required; CI uses Node 24. The API tests use Node's built-in SQLite module and need no npm install, hosting account, network connection or paid service:

```sh
node --test community/lib/community.test.mjs
```

Run that command from the repository root. From this directory, use `node --test lib/community.test.mjs`.

## Build and run your own service

```sh
cd community
npm ci
npm run typecheck
npm run db:migrate:local
npm run dev
```

The local preview binds to `127.0.0.1`. For a production build, run `npm run build`. After creating your own Cloudflare D1 database, replace the placeholder `database_id` in `wrangler.jsonc` with your database ID, apply migrations with `npm run db:migrate:remote`, and deploy the generated Worker with `npm run deploy`. Authenticate Wrangler through its normal local account flow; credentials belong outside this source directory. The desktop service endpoint is fixed in `src-tauri/src/main.rs`, so a self-hosted endpoint requires rebuilding the desktop client.

The service has no subscription, premium entitlement or login requirement. It retains reports for 30 days and enforces explicit upload, read and storage budgets in `lib/community.mjs`; requests stop when those limits are reached. An uploader can revoke a link from the desktop app using a random deletion capability kept on that device. Back up that local capability store if deletion access needs to survive reinstalling the app.

Rankings accept only opted-in complete personal encounters of at least 10 seconds against one named boss. The boss label must match the received target name. Context labels such as region, server and difficulty are supplied by the uploader. These are community submissions, not an official game-verified world ranking. Mixed-target encounters remain shareable without entering rankings.

The repository's root license covers Luma source. Third-party packages retain their respective licenses; dependencies are fetched from the locked package manifest during installation and are not embedded in the Windows application by this directory.
