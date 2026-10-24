import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  brand: text('brand', { enum: ['Toyota', 'Nissan'] }).notNull(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
  reference: text('reference'),
  model: text('model'),
  years: text('years'),
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
  createdAt: text('created_at').notNull().default(''),
});

export const formSettings = sqliteTable('form_settings', { id:text('id').primaryKey(), value:text('value').notNull() });
