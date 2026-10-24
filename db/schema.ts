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
  createdAt: text('created_at').notNull().default(''),
});

export const formSettings = sqliteTable('form_settings', { id:text('id').primaryKey(), value:text('value').notNull() });

export const members=sqliteTable('members',{
 id:integer('id').primaryKey({autoIncrement:true}),email:text('email').notNull().unique(),passwordHash:text('password_hash').notNull(),displayName:text('display_name').notNull(),logoKey:text('logo_key'),backgroundColor:text('background_color').notNull().default('#f5f6f8'),phone:text('phone').notNull(),city:text('city'),brands:text('brands').notNull(),createdAt:text('created_at').notNull(),
});
export const inventory=sqliteTable('inventory',{
 id:integer('id').primaryKey({autoIncrement:true}),ownerId:integer('owner_id').notNull().references(()=>members.id),name:text('name').notNull(),brand:text('brand').notNull(),reference:text('reference'),compatibility:text('compatibility'),price:text('price').notNull(),quantity:integer('quantity').notNull().default(0),partType:text('part_type').notNull(),deletedAt:text('deleted_at'),createdAt:text('created_at').notNull(),
});
export const authLimits=sqliteTable('auth_limits',{id:text('id').primaryKey(),hits:integer('hits').notNull(),resetAt:integer('reset_at').notNull()});
