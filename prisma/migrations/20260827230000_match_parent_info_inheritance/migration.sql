-- Préremplissage automatique des infos parents d'un match (héritage
-- Match > MatchTemplate > Team > réglages généraux du club). Aucune donnée
-- existante modifiée : les valeurs déjà présentes sur les Match existants
-- restent des overrides explicites au sens du nouveau modèle (une valeur
-- non nulle = override, exactement leur comportement actuel).

ALTER TABLE "Team" ADD COLUMN "meetTimeDeltaMinutes" INTEGER;
ALTER TABLE "Team" ADD COLUMN "defaultTransportMode" TEXT;
ALTER TABLE "Team" ADD COLUMN "defaultDressCode" TEXT;
ALTER TABLE "Team" ADD COLUMN "defaultPersonalGear" TEXT;
ALTER TABLE "Team" ADD COLUMN "defaultMealInfo" TEXT;
ALTER TABLE "Team" ADD COLUMN "defaultParentInstructions" TEXT;
ALTER TABLE "Team" ADD COLUMN "defaultDurationMinutes" INTEGER;
ALTER TABLE "Team" ADD COLUMN "defaultReturnDelayMinutes" INTEGER;

CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "meetingPoint" TEXT,
    "parkingInfo" TEXT,
    "accessInfo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");
ALTER TABLE "Venue" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "MatchTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "competition" TEXT,
    "isHome" BOOLEAN,
    "meetTimeDeltaMinutes" INTEGER,
    "transportMode" TEXT,
    "dressCode" TEXT,
    "personalGear" TEXT,
    "mealInfo" TEXT,
    "parentInstructions" TEXT,
    "durationMinutes" INTEGER,
    "returnDelayMinutes" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchTemplate_name_key" ON "MatchTemplate"("name");
ALTER TABLE "MatchTemplate" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Match" ADD COLUMN "venueId" TEXT;
ALTER TABLE "Match" ADD COLUMN "matchTemplateId" TEXT;
ALTER TABLE "Match" ADD COLUMN "parentInfoPublishedAt" TIMESTAMP(3);

ALTER TABLE "Match" ADD CONSTRAINT "Match_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_matchTemplateId_fkey" FOREIGN KEY ("matchTemplateId") REFERENCES "MatchTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Modèles fournis par défaut (§7) — le responsable peut les modifier ou en
-- créer d'autres, jamais imposés silencieusement sur un match existant
-- (matchTemplateId reste NULL sur les Match déjà en base).
INSERT INTO "MatchTemplate" ("id", "name", "competition", "isHome", "meetTimeDeltaMinutes", "transportMode", "dressCode", "durationMinutes", "returnDelayMinutes", "isDefault", "updatedAt") VALUES
  ('tpl_champ_domicile', 'Championnat — Domicile', 'Championnat', true, 45, 'RDV_SUR_PLACE', 'Tenue du club', 60, 15, true, CURRENT_TIMESTAMP),
  ('tpl_champ_exterieur', 'Championnat — Extérieur', 'Championnat', false, 60, 'COVOITURAGE', 'Tenue du club', 60, 45, true, CURRENT_TIMESTAMP),
  ('tpl_amical_domicile', 'Amical — Domicile', 'Amical', true, 30, 'RDV_SUR_PLACE', 'Tenue du club', 60, 15, true, CURRENT_TIMESTAMP),
  ('tpl_amical_exterieur', 'Amical — Extérieur', 'Amical', false, 45, 'COVOITURAGE', 'Tenue du club', 60, 30, true, CURRENT_TIMESTAMP),
  ('tpl_tournoi', 'Tournoi', 'Tournoi', NULL, 75, 'COVOITURAGE', 'Tenue du club + affaires de rechange', NULL, 30, true, CURRENT_TIMESTAMP),
  ('tpl_opposition_interne', 'Opposition interne', 'Autre', true, 15, 'RDV_SUR_PLACE', 'Affaires d''entraînement', 45, 15, true, CURRENT_TIMESTAMP);
