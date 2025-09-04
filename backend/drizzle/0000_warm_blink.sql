CREATE TYPE "public"."note_type" AS ENUM('note', 'todo', 'label', 'file');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('free', 'plus', 'pro');--> statement-breakpoint
CREATE TABLE "notes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"clientside_id" varchar(36) NOT NULL,
	"type" "note_type" DEFAULT 'note' NOT NULL,
	"cipher_text" text,
	"iv" varchar(16),
	"version" integer DEFAULT 1 NOT NULL,
	"serverside_created_at" bigint NOT NULL,
	"serverside_updated_at" bigint NOT NULL,
	"clientside_created_at" bigint NOT NULL,
	"clientside_updated_at" bigint NOT NULL,
	"clientside_deleted_at" bigint,
	"committed_size" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_client_id" UNIQUE("user_id","clientside_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"access_token_hash" varchar(64) NOT NULL,
	"access_token_salt" varchar(32) NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"is_admin" boolean DEFAULT false NOT NULL,
	"login_code" varchar(6),
	"login_code_created_at" bigint,
	"login_tries_left" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"sync_token" varchar(24),
	"confirm_code" varchar(6),
	"confirm_code_created_at" bigint,
	"confirm_code_tries_left" integer DEFAULT 0 NOT NULL,
	"new_email" varchar(255),
	"subscription" "subscription_type" DEFAULT 'free' NOT NULL,
	"successful_login_at" bigint,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;