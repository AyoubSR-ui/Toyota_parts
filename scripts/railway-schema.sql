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
  created_at text DEFAULT '' NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  brand text NOT NULL,
  part_name text NOT NULL,
  reference text,
  model text NOT NULL,
  year integer NOT NULL,
  note text,
  order_type text NOT NULL,
  quantity integer,
  created_at text DEFAULT '' NOT NULL
);
