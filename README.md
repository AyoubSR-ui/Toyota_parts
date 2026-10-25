# Auto Part

Multi-tenant storefront SaaS for auto-parts businesses. Each owner has one independent store, dashboard, inventory, branding and customer enquiries. Arabic, English and French interfaces are included. Payments and subscriptions are intentionally not implemented yet.

## Main routes
- `/`: Auto Part platform homepage and published-store directory.
- `/account`: store registration and sign-in. `/account?mode=register` starts registration.
- `/dashboard`: authenticated owner's dashboard.
- `/stores/:slug`: branded public storefront. Only that store's products are queried.
- `/stores/:slug/admin`: owner-only dashboard entry; a different owner receives 404.
- `/stores/toyota-parts`: founding Toyota Parts store.
- `/admin/login`: existing administrator login for the founding Toyota Parts account. Old admin pages forward to its new dashboard; member accounts cannot authorize legacy admin APIs.
- `/sellers/:id`: compatibility redirect to the canonical store URL.

## Store controls
Owners manage the store name, unique slug, logo, city, WhatsApp, brands, publication status, card/list layout, page background, five dark hero presets, button/accent color, and Arabic/English/French hero titles and descriptions. Three text suggestions and a live preview are provided.

Inventory records include purchase cost, selling price (DZD), quantity, SKU, translated names, reference, model, compatible years, compatibility, original/commercial type, manufacturing country, description and photo. Each item can be featured on the storefront or left accessible through that store's inventory search. Per-item checkboxes select public fields. Purchase cost is always private. Global and per-item price visibility are enforced by public API redaction; public responses never select purchase costs.

Customer requests and uploaded enquiry photos are scoped to their receiving store. Each owner has independent required/visible form settings. The Arabic guided chat uses the current store's data and routes requests to that store. Store QR codes are generated as PNG files using a bundled QR encoder; owners can preview, download, copy links and invoke device-native sharing. No third-party QR or AI API is used.

## Persistence and migration
Railway starts with `pnpm start:railway`. `scripts/railway-storage.mjs` exposes a bearer-protected loopback-only bridge to PostgreSQL. `scripts/postgres-schema.sql` applies additive schema updates, then `scripts/founding-store.sql` idempotently creates Toyota Parts and imports legacy products, images, saved form settings and requests. Original product rows remain intact. Imported quantities are marked unconfirmed instead of presented as verified stock counts. Existing admin credentials authorize only the founding store's account. Its reserved slug remains fixed to preserve that access.

D1/R2 schema changes are tracked in Drizzle migrations through 0012. Existing member slugs are backfilled; new stores receive unique defaults that owners can customize. Members, inventory and leads use owner identifiers; every private inventory query/mutation is constrained by the authenticated owner. Storefront product search requires an explicit store scope. Unpublished stores are removed from public routes and the directory.

Image namespaces are separate: `products`, `requests`, `members`, `inventory`. Railway stores image bytes in corresponding PostgreSQL image tables; D1 installations use R2. Uploaded images accept JPG/PNG/WebP up to 5 MB with signature checks.

## Configuration
Railway requires `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_AUTH_SECRET` and the platform `PORT`. Credentials are passed to the Worker through a gitignored `.dev.vars` file at startup. Member sessions are signed, purpose-separated, HttpOnly cookies with persisted rate limits and salted PBKDF2 hashes. Email remains private. Public store contact details are disclosed on registration.

## Validation
Run `npx tsc --noEmit`, `pnpm build`, then `python scripts/test-members.py`. The integration test launches a local Worker and isolated in-memory database. It validates separate store accounts, migration idempotence, private inventory/costs, public field redaction, featured-vs-full inventory search, slug uniqueness, publication, tenant dashboards, per-store leads/settings, images, QR PNG output, sessions, CSRF and rate limiting. It creates no production fixtures.

Automated email verification and password recovery are not configured in this first release. Custom domains, multiple staff accounts, billing and subscriptions remain future work.
