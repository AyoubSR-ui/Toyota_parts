# Toyota Parts

Bilingual Arabic/English Toyota and Nissan spare parts site. Customers can browse products and submit single-piece or wholesale requests. Admins can add products with optional JPG, PNG, or WebP images (up to 5 MB) and review requests at `/admin`.

## Run locally

```bash
pnpm install
pnpm dev
```

For deployment on Sites, the logical D1 binding is `DB` and product images use the `BUCKET` R2 binding. Run `pnpm db:generate` after schema changes. The checked-in migrations create the `products` and `leads` tables and add product image keys. Do not put customer phone numbers in source control.

The initial deployment is owner-private. The admin routes require ChatGPT sign-in. Before opening the storefront to the public, set the `ADMIN_EMAIL` runtime variable to the administrator's sign-in email so signed-in customers cannot use admin APIs. Public storefront access and any production contact workflow should be configured before launch.

## Railway deployment

The start script listens on `0.0.0.0` and `${PORT:-8000}` to match Railway's public service port. The original persistence bindings (`DB` and `BUCKET`) belong to the Sites deployment. Railway's local Wrangler bindings do not share that production data; configure durable Railway-compatible storage before using Railway for customer requests or product uploads.

The Railway admin uses `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (PBKDF2-SHA256, `iterations:salt:hash` with base64url values), and `ADMIN_AUTH_SECRET` as runtime variables. Run `pnpm start:railway` there. A Railway volume mounted at `/data` is required for durable D1/R2 local storage; the startup script initializes its schema only when `RAILWAY_VOLUME_MOUNT_PATH` is provided. Never commit credentials to Git.

### Railway PostgreSQL storage
Set `DATABASE_URL` to the existing PostgreSQL service reference and use `pnpm start:railway`. Startup creates `products`, `leads`, and `product_images` with non-destructive, idempotent SQL from `scripts/postgres-schema.sql`. Product images (JPG/PNG/WebP, up to 5 MB) are stored as PostgreSQL binary data on the database's persistent volume.
A token-protected Node storage bridge listens only on container loopback; the Worker calls it for database and image operations. Database credentials remain in Node and are never sent to the browser or committed. Existing Cloudflare hosting continues using its D1/R2 bindings when this bridge is absent. Database backups must include all three tables.

### Catalog management
Admins can edit products, replace/remove photos, and delete products from the catalog. Deletion is recoverable with Undo and retains the record and image. Public catalog queries exclude deleted products. Prices are optional non-negative amounts in DZD; products also have Original/Commercial type and country of manufacture. Customer requests accept an optional VIN or frame number, shown in the admin requests list.
PostgreSQL adds the new columns on startup. D1 schema changes are tracked in Drizzle migration 0002.

Incoming customer requests are displayed in a searchable, bilingual table on `/admin/requests`, protected by the same admin login. The Products and Requests navigation links separate catalog work from enquiries.

### Optional request photos
The public part-request form accepts one optional JPG, PNG, or WebP photo (up to 5 MB), with a preview and remove button. Requests may also be submitted without a photo; the API retains JSON support and accepts multipart form uploads. Request photos are stored separately in `request_images`, linked by `leads.image_key`. Admins can open them from the Requests table; the image endpoint requires admin authentication and sends private/no-store cache headers. Startup applies the additive PostgreSQL schema migration; the D1 column is tracked in Drizzle migration 0003.

Request contact numbers use a fixed Algeria (+213) WhatsApp prefix. The client and API accept national, international, spaced and Arabic-digit mobile numbers and normalize valid entries to `+213` plus nine digits. The Requests table labels them as WhatsApp numbers and links valid numbers to WhatsApp. Existing request records are preserved. Public form fields include bilingual guidance and example placeholders.

### Saved request-form rules
Admins configure all 12 customer-request fields at `/admin/form` using Show and Required controls, then save. Configuration is persisted in `form_settings` and fetched without caching by the public form. The API independently enforces the saved rules, ignores hidden field values, and permits nulls for disabled/optional request details while preserving existing records. At least one field must remain visible and a submitted request must contain at least one detail. Quantity follows wholesale selection, or is always available when order type is hidden. Configuration read failures stop submissions rather than bypassing required fields. Drizzle migration 0004 tracks the nullable request columns and settings table; PostgreSQL applies these changes at startup.

### Seller accounts and inventory marketplace
- `/account` supports email/password registration, login, logout, public store profiles, Algerian WhatsApp numbers, city, and up to 30 custom brands. Email stays private; store contact/profile details are explicitly public.
- Member sessions use a separate, purpose-bound HMAC cookie and salted PBKDF2 password hashes. They cannot authorize admin routes. Same-origin JSON mutations and persisted login rate limits protect account endpoints. Railway uses the existing server-side signing secret; no new external API is needed.
- Each member creates, edits and soft-deletes only their own inventory. Every update includes both inventory ID and owner ID. Quantity zero and deleted items are excluded from public search. Prices are per unit in DZD.
- `/search` searches references, names and vehicle compatibility in both the admin catalog and member inventory. `/sellers/:id` displays one seller's public profile and available inventory, with WhatsApp contact links. Results are capped at 100 per source; refine the query when capped.
- `members`, `inventory`, and `auth_limits` are initialized by the PostgreSQL startup schema; Drizzle migration 0007 covers D1. These changes preserve existing products and requests.
- This initial release does not verify email ownership or provide automated password recovery. No email provider or AI API is configured.
- Verify with `npx tsc --noEmit`, `pnpm build`, then `python scripts/test-members.py`. The integration test runs against an isolated in-memory database and local Worker; it creates no production accounts or stock.
