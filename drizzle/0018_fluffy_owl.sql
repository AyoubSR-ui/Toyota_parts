ALTER TABLE `leads` ADD `order_status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `archived_at` text;