CREATE TABLE `kitchens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`kitchen_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`kitchen_id`, `user_id`),
	FOREIGN KEY (`kitchen_id`) REFERENCES `kitchens`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_username` ON `profiles` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_email` ON `profiles` (`email`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`course` text NOT NULL,
	`visibility` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recipes_owner` ON `recipes` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_recipes_visibility` ON `recipes` (`visibility`);--> statement-breakpoint
CREATE TABLE `shares` (
	`recipe_id` text NOT NULL,
	`kitchen_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `kitchen_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kitchen_id`) REFERENCES `kitchens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_shares_kitchen` ON `shares` (`kitchen_id`);