-- 授权码上移到 QQ 分组（v3）：一个 QQ 的三个邮箱共用一个授权码
-- 现有分组都只有一个邮箱，所以直接把该邮箱的加密授权码原样抄到分组上，
-- 抄完、收紧非空后，才删掉 MailAccount 上的旧列；任何一步失败迁移整体回滚，
-- 不会先删后抄造成授权码丢失。
-- 1) 分组上先加可空列
ALTER TABLE "QqGroup" ADD COLUMN "encryptedAuthCode" TEXT;

-- 2) 删掉没有邮箱的空分组（正常不应有，防收紧非空时失败）
DELETE FROM "QqGroup" WHERE "id" NOT IN (SELECT "qqGroupId" FROM "MailAccount");

-- 3) 把每组最早一个邮箱的加密授权码抄到分组上（值原样复制，不解密、不重加密）
UPDATE "QqGroup" SET "encryptedAuthCode" = (
    SELECT "encryptedAuthCode" FROM "MailAccount"
    WHERE "MailAccount"."qqGroupId" = "QqGroup"."id"
    ORDER BY "createdAt" ASC LIMIT 1
);

-- 4) 收紧非空
ALTER TABLE "QqGroup" ALTER COLUMN "encryptedAuthCode" SET NOT NULL;

-- 5) 删掉邮箱上的旧授权码列（此时分组上已有同一份密文）
ALTER TABLE "MailAccount" DROP COLUMN "encryptedAuthCode";
