-- Rencontres d'un plateau (Match.competition === "Plateau") : un plateau
-- n'a pas un adversaire/score unique comme un match classique, mais
-- plusieurs petites rencontres dans la même journée. Purement additif,
-- aucune donnée existante modifiée.

CREATE TABLE "PlateauResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "scoreFor" INTEGER,
    "scoreAgainst" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlateauResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlateauResult_matchId_idx" ON "PlateauResult"("matchId");

ALTER TABLE "PlateauResult" ADD CONSTRAINT "PlateauResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlateauResult" ENABLE ROW LEVEL SECURITY;
