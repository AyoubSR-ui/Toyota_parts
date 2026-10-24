CREATE TABLE `form_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`phone` text,
	`brand` text,
	`part_name` text,
	`reference` text,
	`model` text,
	`year` integer,
	`note` text,
	`order_type` text,
	`quantity` integer,
	`vin_frame` text,
	`image_key` text,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_leads`("id", "name", "phone", "brand", "part_name", "reference", "model", "year", "note", "order_type", "quantity", "vin_frame", "image_key", "created_at") SELECT "id", "name", "phone", "brand", "part_name", "reference", "model", "year", "note", "order_type", "quantity", "vin_frame", "image_key", "created_at" FROM `leads`;--> statement-breakpoint
DROP TABLE `leads`;--> statement-breakpoint
ALTER TABLE `__new_leads` RENAME TO `leads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;