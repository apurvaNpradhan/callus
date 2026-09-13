CREATE TABLE "item" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jwks" (
	"id" text PRIMARY KEY,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE INDEX "item_user_id_idx" ON "item" ("user_id");--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powersync_role') THEN
		GRANT SELECT ON TABLE "item" TO "powersync_role";
	END IF;
END
$$;