PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`reference` text,
	`compatibility` text,
	`price` text,
	`legacy_product_id` integer,
	`stock_confirmed` integer DEFAULT 1 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`part_type` text NOT NULL,
	`image_key` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_inventory`("id", "owner_id", "name", "brand", "reference", "compatibility", "price", "legacy_product_id", "stock_confirmed", "quantity", "part_type", "image_key", "deleted_at", "created_at") SELECT "id", "owner_id", "name", "brand", "reference", "compatibility", "price", NULL, 1, "quantity", "part_type", NULL, "deleted_at", "created_at" FROM `inventory`;--> statement-breakpoint
DROP TABLE `inventory`;--> statement-breakpoint
ALTER TABLE `__new_inventory` RENAME TO `inventory`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_legacy_product_id_unique` ON `inventory` (`legacy_product_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `owner_id` integer REFERENCES members(id);--> statement-breakpoint
ALTER TABLE `members` ADD `store_slug` text;--> statement-breakpoint
ALTER TABLE `members` ADD `account_type` text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_background` text DEFAULT '#171b20' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_eyebrow` text;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_title_ar` text;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_title_en` text;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_text_ar` text;--> statement-breakpoint
ALTER TABLE `members` ADD `hero_text_en` text;--> statement-breakpoint
ALTER TABLE `members` ADD `description` text;--> statement-breakpoint
ALTER TABLE `members` ADD `accent_color` text DEFAULT '#e31837' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `store_layout` text DEFAULT 'cards' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `is_published` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `members_store_slug_unique` ON `members` (`store_slug`);