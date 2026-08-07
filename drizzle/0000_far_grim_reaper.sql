CREATE TABLE `application_field_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`field_key` text NOT NULL,
	`label_kk` text NOT NULL,
	`field_type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`configuration_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_field_definitions_key_unique` ON `application_field_definitions` (`field_key`);--> statement-breakpoint
CREATE TABLE `application_field_values` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`field_definition_id` text NOT NULL,
	`value_text` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `membership_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`field_definition_id`) REFERENCES `application_field_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_field_values_unique` ON `application_field_values` (`application_id`,`field_definition_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action_type` text NOT NULL,
	`target_entity` text NOT NULL,
	`target_entity_id` text NOT NULL,
	`previous_value` text,
	`new_value` text,
	`reason` text,
	`ip_address` text,
	`session_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_entity`,`target_entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `branch_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`branch_id` text NOT NULL,
	`user_id` text NOT NULL,
	`staff_type` text NOT NULL,
	`active_from` text NOT NULL,
	`active_to` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_staff_active_unique` ON `branch_staff` (`branch_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region_code` text NOT NULL,
	`region_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`director_profile_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branches_region_code_unique` ON `branches` (`region_code`);--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`application_id` text,
	`branch_id` text,
	`author_user_id` text NOT NULL,
	`note` text NOT NULL,
	`visibility` text DEFAULT 'central' NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`person_id`) REFERENCES `person_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_id`) REFERENCES `membership_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `internal_notes_application_idx` ON `internal_notes` (`application_id`);--> statement-breakpoint
CREATE TABLE `membership_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`status` text DEFAULT 'awaiting_review' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`decision_reason` text,
	`terms_version` text NOT NULL,
	`terms_accepted_at` text NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`person_id`) REFERENCES `person_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `membership_applications_branch_idx` ON `membership_applications` (`branch_id`);--> statement-breakpoint
CREATE INDEX `membership_applications_status_idx` ON `membership_applications` (`status`);--> statement-breakpoint
CREATE TABLE `membership_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`application_id` text,
	`previous_status` text,
	`new_status` text NOT NULL,
	`reason` text,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`changed_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `person_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_id`) REFERENCES `membership_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `membership_status_history_person_idx` ON `membership_status_history` (`person_id`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_slug_unique` ON `permissions` (`slug`);--> statement-breakpoint
CREATE TABLE `person_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`full_name` text NOT NULL,
	`birth_year` integer,
	`region_code` text NOT NULL,
	`city_district` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`workplace` text,
	`position` text,
	`education` text,
	`professional_experience` text,
	`math_specialization` text,
	`achievements` text,
	`biography` text,
	`membership_status` text DEFAULT 'registered_user' NOT NULL,
	`membership_started_at` text,
	`branch_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_profiles_user_id_unique` ON `person_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `person_profiles_email_unique` ON `person_profiles` (`email`);--> statement-breakpoint
CREATE INDEX `person_profiles_branch_idx` ON `person_profiles` (`branch_id`);--> statement-breakpoint
CREATE INDEX `person_profiles_membership_status_idx` ON `person_profiles` (`membership_status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permissions_unique` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_kk` text NOT NULL,
	`access_level` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_slug_unique` ON `roles` (`slug`);--> statement-breakpoint
CREATE TABLE `uploaded_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_person_id` text NOT NULL,
	`application_id` text,
	`uploaded_by` text,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum_sha256` text NOT NULL,
	`visibility` text DEFAULT 'reviewers' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_person_id`) REFERENCES `person_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_id`) REFERENCES `membership_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploaded_documents_object_key_unique` ON `uploaded_documents` (`object_key`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`scope_type` text DEFAULT 'global' NOT NULL,
	`scope_id` text,
	`granted_by` text,
	`granted_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `user_roles_user_idx` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TRIGGER `prevent_audit_update` BEFORE UPDATE ON `audit_logs` BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `prevent_audit_delete` BEFORE DELETE ON `audit_logs` BEGIN SELECT RAISE(ABORT, 'audit logs are immutable'); END;
