-- CreateTable: 后台邮箱切换 v1，只存账号与加密授权码，不存邮件正文与附件
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL DEFAULT 'imap.qq.com',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "encryptedAuthCode" TEXT NOT NULL,
    "lastTestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MailAccount_email_key" ON "MailAccount"("email");
