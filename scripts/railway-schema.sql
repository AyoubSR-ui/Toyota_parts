CREATE TABLE IF NOT EXISTS products (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  brand text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  reference text,
  model text,
  years text,
  compatibility text,
  description_en text,
  description_ar text,
  price text,
  image_key text,
  part_type text,
  manufacture_country text,
  deleted_at text,
  created_at text DEFAULT '' NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text,
  phone text,
  brand text,
  part_name text,
  reference text,
  model text,
  year integer,
  note text,
  order_type text,
  quantity integer,
  vin_frame text,
  image_key text,
  source text DEFAULT 'form',
  owner_id integer REFERENCES members(id),
  created_at text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS form_settings (id text PRIMARY KEY NOT NULL, value text NOT NULL);

CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 display_name TEXT NOT NULL, phone TEXT NOT NULL, city TEXT, brands TEXT NOT NULL, logo_key TEXT, store_slug TEXT UNIQUE, account_type TEXT NOT NULL DEFAULT 'member', show_prices INTEGER NOT NULL DEFAULT 1, description TEXT, hero_background TEXT NOT NULL DEFAULT '#171b20', hero_eyebrow TEXT,hero_title_ar TEXT,hero_title_en TEXT,hero_text_ar TEXT,hero_text_en TEXT,hero_title_fr TEXT,hero_text_fr TEXT, accent_color TEXT NOT NULL DEFAULT '#e31837', store_layout TEXT NOT NULL DEFAULT 'cards', is_published INTEGER NOT NULL DEFAULT 1, background_color TEXT NOT NULL DEFAULT '#f5f6f8', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES members(id), name TEXT NOT NULL,
 brand TEXT NOT NULL, reference TEXT, compatibility TEXT, price TEXT,
 buy_price TEXT,sku TEXT,name_en TEXT,name_fr TEXT,model TEXT,years TEXT,manufacture_country TEXT,description TEXT,catalog_fields TEXT,
 legacy_product_id INTEGER UNIQUE,is_featured INTEGER NOT NULL DEFAULT 1,show_price INTEGER NOT NULL DEFAULT 1,stock_confirmed INTEGER NOT NULL DEFAULT 1,
 quantity INTEGER NOT NULL DEFAULT 0, part_type TEXT NOT NULL, image_key TEXT, deleted_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inventory_owner_idx ON inventory(owner_id);
CREATE TABLE IF NOT EXISTS auth_limits (id TEXT PRIMARY KEY,hits INTEGER NOT NULL,reset_at INTEGER NOT NULL);
