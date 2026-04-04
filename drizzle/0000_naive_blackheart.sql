CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `approval_guardrails` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`notification_method` text DEFAULT 'Telegram Push' NOT NULL,
	`request_payload` text NOT NULL,
	`is_approved` integer,
	`reviewed_by` text,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`risk_level` text NOT NULL,
	`approval_channel` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `execution_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`message` text NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`owner` text NOT NULL,
	`domain` text NOT NULL,
	`approval_path` text,
	`status` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handoff_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`context_instruction` text NOT NULL,
	`context_data_source` text NOT NULL,
	`context_schedule` text NOT NULL,
	`worker` text DEFAULT 'OPENCLAW' NOT NULL,
	`job_type` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`return_output` text,
	`domain` text NOT NULL,
	`owner_final` text NOT NULL,
	`return_path` text NOT NULL,
	`approval_path` text NOT NULL,
	`risk_level` text DEFAULT 'low' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`rules` text DEFAULT '[]' NOT NULL,
	`tier` text NOT NULL,
	`applies_to` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pilot_evaluation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`criteria` text NOT NULL,
	`is_passed` integer DEFAULT false NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`phase` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planning' NOT NULL,
	`domain` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`title` text NOT NULL,
	`trigger_time` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`owner` text DEFAULT 'HERMES' NOT NULL,
	`domain` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`repeat` text DEFAULT 'none',
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `task_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`owner` text DEFAULT 'HERMES' NOT NULL,
	`domain` text NOT NULL,
	`group_id` text,
	`risk_level` text DEFAULT 'low' NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`username` text,
	`display_username` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
