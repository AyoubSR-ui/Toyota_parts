# Toyota Parts

Bilingual Arabic/English Toyota and Nissan spare parts site. Customers can browse products and submit single-piece or wholesale requests. Admins can add products and review requests at `/admin`.

## Run locally

```bash
pnpm install
pnpm dev
```

For deployment on Sites, the logical D1 binding is `DB`; run `pnpm db:generate` after schema changes. The checked-in migration creates the `products` and `leads` tables. Do not put customer phone numbers in source control.

The initial deployment is owner-private. The admin routes require ChatGPT sign-in. Before opening the storefront to the public, set the `ADMIN_EMAIL` runtime variable to the administrator's sign-in email so signed-in customers cannot use admin APIs. Public storefront access and any production contact workflow should be configured before launch.
