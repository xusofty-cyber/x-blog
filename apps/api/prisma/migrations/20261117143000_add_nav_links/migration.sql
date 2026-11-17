-- CreateTable: 网址导航（纯加法迁移，不影响现有博客、邮箱与 perks 表）
CREATE TABLE "NavCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NavCategory_name_key" ON "NavCategory"("name");

CREATE TABLE "NavLink" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NavLink_categoryId_url_key" ON "NavLink"("categoryId", "url");
CREATE INDEX "NavLink_categoryId_sortOrder_idx" ON "NavLink"("categoryId", "sortOrder");

ALTER TABLE "NavLink" ADD CONSTRAINT "NavLink_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NavCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
