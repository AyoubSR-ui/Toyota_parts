CREATE TABLE IF NOT EXISTS products (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  brand text NOT NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  reference text,
  model text,
  years text,
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
  created_at text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS form_settings (id text PRIMARY KEY NOT NULL, value text NOT NULL);
