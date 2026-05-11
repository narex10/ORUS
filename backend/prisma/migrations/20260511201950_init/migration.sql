-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountId" TEXT,
    "encryptedToken" TEXT,
    "extraConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "integrations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dailyBudget" REAL,
    "lifetimeBudget" REAL,
    "objective" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "budget" REAL,
    "targeting" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ad_sets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adSetId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creativeUrl" TEXT,
    "thumbnailUrl" TEXT,
    "headline" TEXT,
    "body" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_sets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" REAL NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "cpm" REAL,
    "ctr" REAL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "roas" REAL,
    "cpa" REAL,
    CONSTRAINT "campaign_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_set_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adSetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" REAL NOT NULL DEFAULT 0,
    "cpm" REAL,
    "ctr" REAL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "roas" REAL,
    "cpa" REAL,
    CONSTRAINT "ad_set_metrics_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_sets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ad_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" REAL NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "hookRate" REAL,
    "cpm" REAL,
    "ctr" REAL,
    "revenue" REAL NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "roas" REAL,
    "cpa" REAL,
    CONSTRAINT "ad_metrics_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tracking_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tracking_keys_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site_conversions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "trackingKeyId" TEXT,
    "adId" TEXT,
    "type" TEXT NOT NULL,
    "value" REAL,
    "bmId" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "creativeId" TEXT,
    "adsetId" TEXT,
    "siteCampaignId" TEXT,
    "siteCampaignName" TEXT,
    "sessionId" TEXT,
    "fingerprint" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "pageUrl" TEXT,
    "cloakerToken" TEXT,
    "rawParams" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_conversions_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "site_conversions_trackingKeyId_fkey" FOREIGN KEY ("trackingKeyId") REFERENCES "tracking_keys" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "site_conversions_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audiences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "filters" TEXT NOT NULL,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "lastBuiltAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "audiences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audience_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "audienceId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fingerprint" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audience_members_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "audiences" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetLevel" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "checkInterval" INTEGER NOT NULL DEFAULT 60,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "automation_rules_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rule_conditions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'AND',
    "value" REAL NOT NULL,
    "window" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "rule_conditions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rule_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    CONSTRAINT "rule_actions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "log" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rule_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_slug_key" ON "profiles"("userId", "slug");

-- CreateIndex
CREATE INDEX "integrations_profileId_idx" ON "integrations"("profileId");

-- CreateIndex
CREATE INDEX "campaigns_profileId_idx" ON "campaigns"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_integrationId_externalId_key" ON "campaigns"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "ad_sets_campaignId_idx" ON "ad_sets"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_sets_campaignId_externalId_key" ON "ad_sets"("campaignId", "externalId");

-- CreateIndex
CREATE INDEX "ads_adSetId_idx" ON "ads"("adSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ads_adSetId_externalId_key" ON "ads"("adSetId", "externalId");

-- CreateIndex
CREATE INDEX "campaign_metrics_campaignId_date_idx" ON "campaign_metrics"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_campaignId_date_key" ON "campaign_metrics"("campaignId", "date");

-- CreateIndex
CREATE INDEX "ad_set_metrics_adSetId_date_idx" ON "ad_set_metrics"("adSetId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_set_metrics_adSetId_date_key" ON "ad_set_metrics"("adSetId", "date");

-- CreateIndex
CREATE INDEX "ad_metrics_adId_date_idx" ON "ad_metrics"("adId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ad_metrics_adId_date_key" ON "ad_metrics"("adId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_keys_key_key" ON "tracking_keys"("key");

-- CreateIndex
CREATE INDEX "tracking_keys_profileId_idx" ON "tracking_keys"("profileId");

-- CreateIndex
CREATE INDEX "site_conversions_profileId_type_idx" ON "site_conversions"("profileId", "type");

-- CreateIndex
CREATE INDEX "site_conversions_profileId_createdAt_idx" ON "site_conversions"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "site_conversions_siteCampaignId_idx" ON "site_conversions"("siteCampaignId");

-- CreateIndex
CREATE INDEX "audiences_profileId_idx" ON "audiences"("profileId");

-- CreateIndex
CREATE INDEX "audience_members_audienceId_idx" ON "audience_members"("audienceId");

-- CreateIndex
CREATE INDEX "automation_rules_profileId_idx" ON "automation_rules"("profileId");

-- CreateIndex
CREATE INDEX "rule_executions_ruleId_idx" ON "rule_executions"("ruleId");
