-- Migration to convert integer IDs to bigint IDs while preserving data
-- This migration handles the conversion safely without data loss

-- Step 1: Create new tables with bigint IDs
CREATE TABLE "users_new" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_new_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email" varchar(255) NOT NULL,
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
	CONSTRAINT "users_new_email_unique" UNIQUE("email")
);

CREATE TABLE "sessions_new" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sessions_new_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"access_token_hash" varchar(64) NOT NULL,
	"access_token_salt" varchar(32) NOT NULL,
	"created_at" bigint NOT NULL
);

CREATE TABLE "notes_new" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_new_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
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
	CONSTRAINT "user_client_id_new" UNIQUE("user_id","clientside_id")
);

-- Step 2: Copy data from old tables to new tables with OVERRIDING SYSTEM VALUE
INSERT INTO "users_new" ("id", "email", "login_code", "login_code_created_at", "login_tries_left", "created_at", "updated_at", "sync_token", "confirm_code", "confirm_code_created_at", "confirm_code_tries_left", "new_email", "subscription")
OVERRIDING SYSTEM VALUE
SELECT "id", "email", "login_code", "login_code_created_at", "login_tries_left", "created_at", "updated_at", "sync_token", "confirm_code", "confirm_code_created_at", "confirm_code_tries_left", "new_email", "subscription"
FROM "users";

INSERT INTO "sessions_new" ("id", "user_id", "access_token_hash", "access_token_salt", "created_at")
OVERRIDING SYSTEM VALUE
SELECT "id", "user_id", "access_token_hash", "access_token_salt", "created_at"
FROM "sessions";

INSERT INTO "notes_new" ("id", "user_id", "clientside_id", "type", "cipher_text", "iv", "version", "serverside_created_at", "serverside_updated_at", "clientside_created_at", "clientside_updated_at", "clientside_deleted_at", "committed_size")
OVERRIDING SYSTEM VALUE
SELECT "id", "user_id", "clientside_id", "type", "cipher_text", "iv", "version", "serverside_created_at", "serverside_updated_at", "clientside_created_at", "clientside_updated_at", "clientside_deleted_at", "committed_size"
FROM "notes";

-- Step 3: Set sequence values to continue from the highest ID
SELECT setval('users_new_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM users_new));
SELECT setval('sessions_new_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM sessions_new));
SELECT setval('notes_new_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM notes_new));

-- Step 4: Add foreign key constraints to new tables
ALTER TABLE "sessions_new" ADD CONSTRAINT "sessions_new_user_id_users_new_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_new"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notes_new" ADD CONSTRAINT "notes_new_user_id_users_new_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users_new"("id") ON DELETE no action ON UPDATE no action;

-- Step 5: Drop old tables
DROP TABLE "notes";
DROP TABLE "sessions";
DROP TABLE "users";

-- Step 6: Rename new tables to original names
ALTER TABLE "users_new" RENAME TO "users";
ALTER TABLE "sessions_new" RENAME TO "sessions";
ALTER TABLE "notes_new" RENAME TO "notes";

-- Step 7: Rename constraints to original names
ALTER TABLE "users" RENAME CONSTRAINT "users_new_email_unique" TO "users_email_unique";
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_new_user_id_users_new_id_fk" TO "sessions_user_id_users_id_fk";
ALTER TABLE "notes" RENAME CONSTRAINT "notes_new_user_id_users_new_id_fk" TO "notes_user_id_users_id_fk";
ALTER TABLE "notes" RENAME CONSTRAINT "user_client_id_new" TO "user_client_id";

-- Step 8: Rename sequences to original names
ALTER SEQUENCE "users_new_id_seq" RENAME TO "users_id_seq";
ALTER SEQUENCE "sessions_new_id_seq" RENAME TO "sessions_id_seq";
ALTER SEQUENCE "notes_new_id_seq" RENAME TO "notes_id_seq";