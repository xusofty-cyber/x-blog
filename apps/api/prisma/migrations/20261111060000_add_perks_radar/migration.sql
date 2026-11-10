-- CreateTable: 后台优惠雷达（Perks Radar），纯加法迁移，不影响现有博客与邮箱表
CREATE TABLE "PerkRound" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PerkRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerkSourceRun" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "notModified" BOOLEAN NOT NULL DEFAULT false,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "finalUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PerkSourceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerkSourceState" (
    "sourceId" TEXT NOT NULL,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerkSourceState_pkey" PRIMARY KEY ("sourceId")
);

CREATE TABLE "PerkItem" (
    "id" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenRoundId" TEXT,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerkItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerkRound_startedAt_idx" ON "PerkRound"("startedAt");
CREATE INDEX "PerkRound_trigger_startedAt_idx" ON "PerkRound"("trigger", "startedAt");
CREATE INDEX "PerkSourceRun_roundId_idx" ON "PerkSourceRun"("roundId");
CREATE INDEX "PerkSourceRun_sourceId_startedAt_idx" ON "PerkSourceRun"("sourceId", "startedAt");
CREATE UNIQUE INDEX "PerkItem_canonicalUrl_key" ON "PerkItem"("canonicalUrl");
CREATE INDEX "PerkItem_sourceId_category_idx" ON "PerkItem"("sourceId", "category");
CREATE INDEX "PerkItem_publishedAt_idx" ON "PerkItem"("publishedAt");
CREATE INDEX "PerkItem_firstSeenAt_idx" ON "PerkItem"("firstSeenAt");
CREATE INDEX "PerkItem_isBookmarked_idx" ON "PerkItem"("isBookmarked");

ALTER TABLE "PerkSourceRun" ADD CONSTRAINT "PerkSourceRun_roundId_fkey"
    FOREIGN KEY ("roundId") REFERENCES "PerkRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PerkItem" ADD CONSTRAINT "PerkItem_firstSeenRoundId_fkey"
    FOREIGN KEY ("firstSeenRoundId") REFERENCES "PerkRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

