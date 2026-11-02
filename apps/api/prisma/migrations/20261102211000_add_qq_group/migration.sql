-- QQ 分组（v2，纯加法迁移，绝不删 MailAccount 行、不改 encryptedAuthCode）
-- 1) 新建 QqGroup 表
CREATE TABLE "QqGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QqGroup_pkey" PRIMARY KEY ("id")
);

-- 2) 每个已有邮箱账号原地变成一个 QQ 分组：分组 id 直接复用账号 id，
--    分组名复用账号备注名，授权码、邮箱等字段一律不动
INSERT INTO "QqGroup" ("id", "label", "createdAt", "updatedAt")
SELECT "id", "label", "createdAt", "updatedAt" FROM "MailAccount";

-- 3) 给 MailAccount 加分组与邮箱类型两列（先可空，填好后再收紧）
ALTER TABLE "MailAccount" ADD COLUMN "qqGroupId" TEXT;
ALTER TABLE "MailAccount" ADD COLUMN "mailboxType" TEXT NOT NULL DEFAULT 'numeric';

-- 4) 每个已有邮箱归入以自身 id 命名的分组，类型按邮箱地址推断
UPDATE "MailAccount" SET "qqGroupId" = "id";
UPDATE "MailAccount" SET "mailboxType" = CASE
    WHEN "email" LIKE '%@foxmail.com' THEN 'foxmail'
    WHEN split_part("email", '@', 1) ~ '^[0-9]+$' THEN 'numeric'
    ELSE 'letter'
END;

-- 5) 收紧分组外键（删除分组时级联删除其下邮箱）
ALTER TABLE "MailAccount" ALTER COLUMN "qqGroupId" SET NOT NULL;
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_qqGroupId_fkey"
    FOREIGN KEY ("qqGroupId") REFERENCES "QqGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MailAccount_qqGroupId_idx" ON "MailAccount"("qqGroupId");
