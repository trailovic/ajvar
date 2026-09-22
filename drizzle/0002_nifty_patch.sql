CREATE TABLE `recipe_links` (
	`recipe_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recipe_links_token` ON `recipe_links` (`token`);