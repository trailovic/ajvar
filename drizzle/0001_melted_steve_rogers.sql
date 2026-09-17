CREATE TABLE `auth_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_auth_identities_profile` ON `auth_identities` (`profile_id`);