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
