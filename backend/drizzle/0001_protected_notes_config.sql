CREATE TABLE "protected_notes_config" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"master_salt" varchar(24) NOT NULL,
	"verifier" text NOT NULL,
	"verifier_iv" varchar(16) NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "protected_notes_config" ADD CONSTRAINT "protected_notes_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;