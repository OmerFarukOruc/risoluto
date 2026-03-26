CREATE TABLE `attempts` (
	`attempt_id` text PRIMARY KEY NOT NULL,
	`issue_id` text NOT NULL,
	`issue_identifier` text NOT NULL,
	`title` text NOT NULL,
	`workspace_key` text,
	`workspace_path` text,
	`status` text NOT NULL,
	`attempt_number` integer,
	`started_at` text NOT NULL,
	`ended_at` text,
	`model` text NOT NULL,
	`reasoning_effort` text,
	`model_source` text NOT NULL,
	`thread_id` text,
	`turn_id` text,
	`turn_count` integer NOT NULL,
	`error_code` text,
	`error_message` text,
	`token_usage_input_tokens` integer,
	`token_usage_output_tokens` integer,
	`token_usage_total_tokens` integer,
	`pull_request_url` text,
	`stop_signal` text
);
--> statement-breakpoint
CREATE INDEX `attempts_issue_identifier_idx` ON `attempts` (`issue_identifier`);--> statement-breakpoint
CREATE INDEX `attempts_status_idx` ON `attempts` (`status`);--> statement-breakpoint
CREATE INDEX `attempts_started_at_idx` ON `attempts` (`started_at`);--> statement-breakpoint
CREATE TABLE `config_overlays` (
	`path` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_overlays_updated_at_idx` ON `config_overlays` (`updated_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`row_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`at` text NOT NULL,
	`issue_id` text,
	`issue_identifier` text,
	`session_id` text,
	`event` text NOT NULL,
	`message` text NOT NULL,
	`content` text,
	`metadata_json` text,
	`usage_input_tokens` integer,
	`usage_output_tokens` integer,
	`usage_total_tokens` integer,
	`rate_limits_json` text,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`attempt_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_attempt_sequence_idx` ON `events` (`attempt_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `events_attempt_at_idx` ON `events` (`attempt_id`,`at`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`key` text PRIMARY KEY NOT NULL,
	`algorithm` text NOT NULL,
	`iv` text NOT NULL,
	`auth_tag` text NOT NULL,
	`ciphertext` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `secrets_updated_at_idx` ON `secrets` (`updated_at`);