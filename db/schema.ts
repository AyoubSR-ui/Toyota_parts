import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  brand: text('brand', { enum: ['Toyota', 'Nissan'] }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  reference: text('reference'),
  model: text('model'),
  years: text('years'),
  compatibility: text('compatibility'),
  descriptionEn: text('description_en'),
  descriptionAr: text('description_ar'),
  price: text('price'),
  imageKey: text('image_key'),
  partType: text('part_type', { enum: ['original', 'commercial'] }),
  manufactureCountry: text('manufacture_country'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(''),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  phone: text('phone'),
  brand: text('brand', { enum: ['Toyota', 'Nissan'] }),
  partName: text('part_name'),
  reference: text('reference'),
  model: text('model'),
  year: integer('year'),
  note: text('note'),
  orderType: text('order_type', { enum: ['single', 'wholesale'] }),
  quantity: integer('quantity'),
  vinFrame: text('vin_frame'),
  imageKey: text('image_key'),
  source: text('source').default('form'),
  ownerId: integer('owner_id').references(()=>members.id),
  createdAt: text('created_at').notNull().default(''),
});

export const formSettings = sqliteTable('form_settings', { id:text('id').primaryKey(), value:text('value').notNull() });

export const members=sqliteTable('members',{
 id:integer('id').primaryKey({autoIncrement:true}),email:text('email').notNull().unique(),passwordHash:text('password_hash').notNull(),displayName:text('display_name').notNull(),logoKey:text('logo_key'),storeSlug:text('store_slug').unique(),storeReference:text('store_reference').unique(),accountType:text('account_type').notNull().default('member'),showPrices:integer('show_prices').notNull().default(1),heroBackground:text('hero_background').notNull().default('#171b20'),heroEyebrow:text('hero_eyebrow'),heroTitleAr:text('hero_title_ar'),heroTitleEn:text('hero_title_en'),heroTextAr:text('hero_text_ar'),heroTextEn:text('hero_text_en'),heroTitleFr:text('hero_title_fr'),heroTextFr:text('hero_text_fr'),description:text('description'),accentColor:text('accent_color').notNull().default('#e31837'),storeLayout:text('store_layout').notNull().default('cards'),isPublished:integer('is_published').notNull().default(1),backgroundColor:text('background_color').notNull().default('#f5f6f8'),phone:text('phone').notNull(),city:text('city'),brands:text('brands').notNull(),createdAt:text('created_at').notNull(),
});
export const inventory=sqliteTable('inventory',{
 id:integer('id').primaryKey({autoIncrement:true}),ownerId:integer('owner_id').notNull().references(()=>members.id),name:text('name').notNull(),brand:text('brand').notNull(),reference:text('reference'),compatibility:text('compatibility'),price:text('price'),buyPrice:text('buy_price'),sku:text('sku'),nameEn:text('name_en'),nameFr:text('name_fr'),model:text('model'),years:text('years'),manufactureCountry:text('manufacture_country'),description:text('description'),catalogFields:text('catalog_fields'),legacyProductId:integer('legacy_product_id').unique(),isFeatured:integer('is_featured').notNull().default(1),showPrice:integer('show_price').notNull().default(1),stockConfirmed:integer('stock_confirmed').notNull().default(1),quantity:integer('quantity').notNull().default(0),partType:text('part_type').notNull(),imageKey:text('image_key'),deletedAt:text('deleted_at'),createdAt:text('created_at').notNull(),
});
export const authLimits=sqliteTable('auth_limits',{id:text('id').primaryKey(),hits:integer('hits').notNull(),resetAt:integer('reset_at').notNull()});
