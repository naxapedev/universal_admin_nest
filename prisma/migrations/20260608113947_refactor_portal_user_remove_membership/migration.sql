-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('Active', 'Suspended');

-- CreateEnum
CREATE TYPE "ArchitectureType" AS ENUM ('SINGLE_DB', 'MULTI_TENANT');

-- CreateEnum
CREATE TYPE "DbDriver" AS ENUM ('MONGODB', 'MYSQL');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('code', 'link', 'none');

-- CreateTable
CREATE TABLE "portal_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "role" TEXT[] DEFAULT ARRAY['lead']::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "lock_until" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "verificationCode" INTEGER,
    "verificationCodeExpiresAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_users" (
    "id" TEXT NOT NULL,
    "global_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "username" TEXT,
    "platform_role" TEXT NOT NULL DEFAULT 'User',
    "global_company_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "verification_code" TEXT,
    "verification_token" TEXT,
    "verification_expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domain" TEXT,
    "db_uri" TEXT,
    "dbName" TEXT,
    "admin_global_user_id" TEXT,
    "admin_email" TEXT,
    "admin_first_name" TEXT,
    "admin_last_name" TEXT,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "enabled_features" JSONB NOT NULL DEFAULT '{"billing": true, "reports": true, "map_monitoring": true, "messaging": true, "teams": true}',
    "capacity_limits" JSONB NOT NULL DEFAULT '{"max_users": 0, "max_admins": 0, "max_dispatchers": 0, "max_drivers": 0, "max_managers": 0, "max_jobs_per_day": 0, "max_trips_per_day": 0, "max_clinics": 0, "max_routes": 0, "max_willcalls": 0}',
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visas" (
    "id" TEXT NOT NULL,
    "global_user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'User',
    "status" "VisaStatus" NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universal_refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "portal_user_id" TEXT,
    "global_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universal_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_registries" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "architecture_type" "ArchitectureType" NOT NULL,
    "db_driver" "DbDriver" NOT NULL,
    "db_uri" TEXT NOT NULL,
    "app_private_key" TEXT NOT NULL,
    "app_public_key" TEXT NOT NULL,
    "verification_method" "VerificationMethod" NOT NULL DEFAULT 'code',
    "frontend_url" TEXT,
    "ui_schema" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_registries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_email_key" ON "portal_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "global_users_global_user_id_key" ON "global_users"("global_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_users_email_key" ON "global_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "global_users_username_key" ON "global_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "visas_global_user_id_product_id_key" ON "visas"("global_user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "universal_refresh_tokens_token_key" ON "universal_refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "product_registries_product_id_key" ON "product_registries"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_registries_name_key" ON "product_registries"("name");

-- AddForeignKey
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_refresh_tokens" ADD CONSTRAINT "universal_refresh_tokens_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universal_refresh_tokens" ADD CONSTRAINT "universal_refresh_tokens_global_user_id_fkey" FOREIGN KEY ("global_user_id") REFERENCES "global_users"("global_user_id") ON DELETE CASCADE ON UPDATE CASCADE;
