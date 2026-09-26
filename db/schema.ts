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
  createdAt: text('created_at').notNull().default(''),
});

export const leads = sqliteTable('leads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  brand: text('brand', { enum: ['Toyota', 'Nissan'] }).notNull(),
  partName: text('part_name').notNull(),
  reference: text('reference'),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  note: text('note'),
  orderType: text('order_type', { enum: ['single', 'wholesale'] }).notNull(),
  quantity: integer('quantity'),
  createdAt: text('created_at').notNull().default(''),
});
