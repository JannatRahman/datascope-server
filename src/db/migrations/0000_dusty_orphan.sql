CREATE TYPE "public"."dataset_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."field_data_type" AS ENUM('text', 'number', 'boolean', 'date', 'email', 'url');--> statement-breakpoint
CREATE TYPE "public"."dataset_access_level" AS ENUM('viewer', 'editor', 'manager');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('user', 'dataset', 'record', 'authentication', 'permission', 'system');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('csv');--> statement-breakpoint
CREATE TYPE "public"."export_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('export_completed', 'export_failed', 'saved_view_shared', 'dataset_access_granted', 'dataset_access_changed', 'system');--> statement-breakpoint
CREATE TYPE "public"."performance_operation" AS ENUM('search', 'filter', 'sort', 'pagination', 'export', 'analytics', 'other');--> statement-breakpoint
CREATE TYPE "public"."record_change_type" AS ENUM('created', 'updated', 'deleted');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"field_label" varchar(150) NOT NULL,
	"data_type" "field_data_type" DEFAULT 'text' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_searchable" boolean DEFAULT false NOT NULL,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"is_sortable" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"field_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dataset_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"record_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"data_source" varchar(100),
	"owner_id" text NOT NULL,
	"status" "dataset_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dataset_members" (
	"dataset_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"access_level" "dataset_access_level" DEFAULT 'viewer' NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dataset_members_dataset_id_user_id_pk" PRIMARY KEY("dataset_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"user_id" text NOT NULL,
	"dataset_id" uuid NOT NULL,
	"search_query" text,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visible_columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_view_shares" (
	"saved_view_id" uuid NOT NULL,
	"shared_with_user_id" text NOT NULL,
	"shared_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_view_shares_saved_view_id_shared_with_user_id_pk" PRIMARY KEY("saved_view_id","shared_with_user_id")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"dataset_id" uuid,
	"search_query" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"execution_time_ms" integer,
	"searched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"activity_type" "activity_type" NOT NULL,
	"action" varchar(100) NOT NULL,
	"description" text,
	"resource_type" varchar(100),
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"dataset_id" uuid NOT NULL,
	"status" "export_job_status" DEFAULT 'pending' NOT NULL,
	"format" "export_format" DEFAULT 'csv' NOT NULL,
	"export_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_path" text,
	"file_name" text,
	"total_records" integer,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_performance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"dataset_id" uuid,
	"operation" "performance_operation" NOT NULL,
	"endpoint" varchar(255),
	"execution_time_ms" integer NOT NULL,
	"records_returned" integer DEFAULT 0 NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"dataset_id" uuid NOT NULL,
	"changed_by" text,
	"change_type" "record_change_type" NOT NULL,
	"previous_data" jsonb,
	"new_data" jsonb,
	"change_description" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_dataset_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"target_dataset_id" uuid NOT NULL,
	"target_record_id" uuid NOT NULL,
	"relationship_type" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"theme" varchar(20) DEFAULT 'system' NOT NULL,
	"table_density" varchar(20) DEFAULT 'comfortable' NOT NULL,
	"default_page_size" integer DEFAULT 25 NOT NULL,
	"sidebar_collapsed" boolean DEFAULT false NOT NULL,
	"dashboard_layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"additional_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_fields" ADD CONSTRAINT "dataset_fields_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_records" ADD CONSTRAINT "dataset_records_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_records" ADD CONSTRAINT "dataset_records_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_records" ADD CONSTRAINT "dataset_records_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_members" ADD CONSTRAINT "dataset_members_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_members" ADD CONSTRAINT "dataset_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dataset_members" ADD CONSTRAINT "dataset_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_shares" ADD CONSTRAINT "saved_view_shares_saved_view_id_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "public"."saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_shares" ADD CONSTRAINT "saved_view_shares_shared_with_user_id_user_id_fk" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view_shares" ADD CONSTRAINT "saved_view_shares_shared_by_user_id_user_id_fk" FOREIGN KEY ("shared_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_performance_logs" ADD CONSTRAINT "query_performance_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_performance_logs" ADD CONSTRAINT "query_performance_logs_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_history" ADD CONSTRAINT "record_history_record_id_dataset_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."dataset_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_history" ADD CONSTRAINT "record_history_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_history" ADD CONSTRAINT "record_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relationships" ADD CONSTRAINT "record_relationships_source_dataset_id_datasets_id_fk" FOREIGN KEY ("source_dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relationships" ADD CONSTRAINT "record_relationships_source_record_id_dataset_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."dataset_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relationships" ADD CONSTRAINT "record_relationships_target_dataset_id_datasets_id_fk" FOREIGN KEY ("target_dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_relationships" ADD CONSTRAINT "record_relationships_target_record_id_dataset_records_id_fk" FOREIGN KEY ("target_record_id") REFERENCES "public"."dataset_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_role_id_idx" ON "user" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "dataset_fields_dataset_id_idx" ON "dataset_fields" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "dataset_fields_created_at_idx" ON "dataset_fields" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dataset_fields_dataset_created_idx" ON "dataset_fields" USING btree ("dataset_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dataset_fields_dataset_id_id_unique" ON "dataset_fields" USING btree ("dataset_id","id");--> statement-breakpoint
CREATE INDEX "dataset_records_dataset_id_idx" ON "dataset_records" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "dataset_records_created_at_idx" ON "dataset_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dataset_records_dataset_created_idx" ON "dataset_records" USING btree ("dataset_id","created_at");--> statement-breakpoint
CREATE INDEX "datasets_owner_id_idx" ON "datasets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "datasets_status_idx" ON "datasets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "datasets_created_at_idx" ON "datasets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dataset_members_user_id_idx" ON "dataset_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dataset_members_access_level_idx" ON "dataset_members" USING btree ("access_level");--> statement-breakpoint
CREATE INDEX "saved_views_user_id_idx" ON "saved_views" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_views_dataset_id_idx" ON "saved_views" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "saved_views_created_at_idx" ON "saved_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "saved_views_user_dataset_idx" ON "saved_views" USING btree ("user_id","dataset_id");--> statement-breakpoint
CREATE INDEX "saved_view_shares_user_id_idx" ON "saved_view_shares" USING btree ("shared_with_user_id");--> statement-breakpoint
CREATE INDEX "saved_view_shares_shared_by_idx" ON "saved_view_shares" USING btree ("shared_by_user_id");--> statement-breakpoint
CREATE INDEX "search_history_user_id_idx" ON "search_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_history_dataset_id_idx" ON "search_history" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "search_history_searched_at_idx" ON "search_history" USING btree ("searched_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_activity_type_idx" ON "activity_logs" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_resource_idx" ON "activity_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "export_jobs_user_id_idx" ON "export_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "export_jobs_dataset_id_idx" ON "export_jobs" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "export_jobs_status_idx" ON "export_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_jobs_requested_at_idx" ON "export_jobs" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "export_jobs_user_status_idx" ON "export_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "query_performance_operation_idx" ON "query_performance_logs" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "query_performance_execution_time_idx" ON "query_performance_logs" USING btree ("execution_time_ms");--> statement-breakpoint
CREATE INDEX "query_performance_dataset_idx" ON "query_performance_logs" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "query_performance_created_at_idx" ON "query_performance_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "query_performance_cache_hit_idx" ON "query_performance_logs" USING btree ("cache_hit");--> statement-breakpoint
CREATE INDEX "record_history_record_id_idx" ON "record_history" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_history_dataset_id_idx" ON "record_history" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "record_history_changed_at_idx" ON "record_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "record_history_record_changed_at_idx" ON "record_history" USING btree ("record_id","changed_at");--> statement-breakpoint
CREATE INDEX "record_relationships_source_idx" ON "record_relationships" USING btree ("source_record_id");--> statement-breakpoint
CREATE INDEX "record_relationships_target_idx" ON "record_relationships" USING btree ("target_record_id");--> statement-breakpoint
CREATE INDEX "record_relationships_source_dataset_idx" ON "record_relationships" USING btree ("source_dataset_id");--> statement-breakpoint
CREATE INDEX "record_relationships_target_dataset_idx" ON "record_relationships" USING btree ("target_dataset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_unique" ON "user_preferences" USING btree ("user_id");