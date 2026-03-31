-- Add is_business column to client_metricool_config
ALTER TABLE "public"."client_metricool_config" ADD COLUMN "is_business" boolean DEFAULT true;
