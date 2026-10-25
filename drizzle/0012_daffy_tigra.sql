ALTER TABLE `inventory` ADD `buy_price` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `sku` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `name_en` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `name_fr` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `model` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `years` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `manufacture_country` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `description` text;--> statement-breakpoint
ALTER TABLE `inventory` ADD `catalog_fields` text;
--> statement-breakpoint
UPDATE inventory SET name_en=(SELECT p.name_en FROM products p WHERE p.id=inventory.legacy_product_id),model=(SELECT p.model FROM products p WHERE p.id=inventory.legacy_product_id),years=(SELECT p.years FROM products p WHERE p.id=inventory.legacy_product_id),manufacture_country=(SELECT p.manufacture_country FROM products p WHERE p.id=inventory.legacy_product_id),description=(SELECT COALESCE(p.description_ar,p.description_en) FROM products p WHERE p.id=inventory.legacy_product_id) WHERE legacy_product_id IS NOT NULL;
