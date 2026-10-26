ALTER TABLE `members` ADD `store_reference` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_store_reference_unique` ON `members` (`store_reference`);