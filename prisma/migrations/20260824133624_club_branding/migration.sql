-- Identité visuelle du club (nom, logo, couleurs) — une seule ligne (id=1),
-- créée paresseusement au premier enregistrement (mirror du pattern Settings).
-- Le logo est stocké en base (BYTEA) : aucune solution de stockage externe
-- n'existait déjà dans le projet, servi par /api/club/logo.
CREATE TABLE "Club" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Mon club',
    "shortName" TEXT,
    "logoData" BYTEA,
    "logoMimeType" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3F8F5B',
    "secondaryColor" TEXT NOT NULL DEFAULT '#3C6E9F',
    "accentColor" TEXT NOT NULL DEFAULT '#C97A17',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Club" ENABLE ROW LEVEL SECURITY;
