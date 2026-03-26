-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_key_key" ON "User"("key");
