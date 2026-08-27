-- Remplace le flux "mot de passe temporaire envoyé par email" par une
-- invitation à activer : le club ne crée plus de mot de passe pour les
-- familles, il donne un droit d'accès via un lien personnel à usage unique
-- que le parent utilise pour choisir lui-même son mot de passe.
--
-- Aucune donnée existante modifiée : les ParentAccount déjà actifs (et leur
-- éventuel mustChangePassword=true hérité de l'ancien flux) restent
-- intacts et continuent de fonctionner exactement comme avant — ce nouveau
-- système ne s'applique qu'aux nouveaux accès. Uniquement des CREATE TABLE.
CREATE TABLE "ParentInvitation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "ParentInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentInvitation_tokenHash_key" ON "ParentInvitation"("tokenHash");

CREATE INDEX "ParentInvitation_playerId_idx" ON "ParentInvitation"("playerId");

CREATE INDEX "ParentInvitation_email_idx" ON "ParentInvitation"("email");

CREATE INDEX "ParentInvitation_expiresAt_idx" ON "ParentInvitation"("expiresAt");

ALTER TABLE "ParentInvitation" ADD CONSTRAINT "ParentInvitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentInvitation" ADD CONSTRAINT "ParentInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ParentInvitation" ENABLE ROW LEVEL SECURITY;

-- Mot de passe oublié (Parent) — même discipline de jeton que ci-dessus,
-- expiration courte (30 minutes, appliquée côté application).
CREATE TABLE "ParentPasswordResetToken" (
    "id" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentPasswordResetToken_tokenHash_key" ON "ParentPasswordResetToken"("tokenHash");

CREATE INDEX "ParentPasswordResetToken_parentAccountId_idx" ON "ParentPasswordResetToken"("parentAccountId");

CREATE INDEX "ParentPasswordResetToken_expiresAt_idx" ON "ParentPasswordResetToken"("expiresAt");

ALTER TABLE "ParentPasswordResetToken" ADD CONSTRAINT "ParentPasswordResetToken_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentPasswordResetToken" ENABLE ROW LEVEL SECURITY;

-- Rate limiting compatible serverless (compteur Postgres, pas de Map en
-- mémoire — plusieurs instances Vercel ne partageraient pas cette mémoire).
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimitHit_key_createdAt_idx" ON "RateLimitHit"("key", "createdAt");

ALTER TABLE "RateLimitHit" ENABLE ROW LEVEL SECURITY;
