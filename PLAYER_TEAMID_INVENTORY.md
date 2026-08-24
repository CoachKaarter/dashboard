# Recensement des usages de `Player.teamId` (V5.2 — Phase 9)

Ce document est un **inventaire, pas un plan d'action**. Aucune ligne de code n'a été
modifiée pour le produire. Il prépare une dépréciation prudente et étalée dans le temps
de `Player.teamId` comme source de vérité, conformément à l'esprit du cahier des charges
V5.2 (§45) :

> « Le joueur n'est pas "un joueur U13A". Il est un joueur U13 qui évolue réellement dans
> différentes équipes au cours de la saison. »

`Player.teamId` reste un champ légitime — c'est le mécanisme qui enregistre l'équipe
**administrative/habituelle** d'un joueur (cf. Bucket E ci-dessous) — mais il ne doit pas
être utilisé comme preuve de "quelle équipe ce joueur a-t-il défendue à ce match précis".
Cette preuve-là existe déjà ailleurs dans le modèle de données : `WeekendAssignment`,
`MatchConvocation`, `CompositionSlot`, et surtout `MatchPlayerStat` (accessible via
`match.team`).

Recensement réalisé par grep exhaustif de `teamId` sur `src/` (hors `src/generated/`,
code auto-généré par Prisma) le 2026-08-24, ~156 occurrences brutes.

## Déjà corrigé (phases précédentes de V5.2)

1. **`src/lib/authz.ts`** (`canAccessTeam`) + **`src/app/(app)/matchs/actions.ts`**
   (`assertPlayerOnMatchTeam`, Phase 0) — la validation serveur des convocations,
   compositions et feuilles de match est scopée par `player.team.category`, pas par
   `teamId` exact, pour autoriser le dépannage intra-catégorie.
2. **`src/app/(app)/joueurs/[id]/page.tsx`** (onglet "Matchs", Phase 8) — l'historique de
   match et le calcul "Équipe habituelle" utilisent `match.team.code` (l'équipe réelle du
   match, via `MatchPlayerStat → Match → Team`), plus jamais `stats.teamCode` (l'équipe
   *actuelle* du joueur).

## Point central : `src/lib/stats.ts`

`getPlayerStatsByTeam` / `getPlayerStatsById` lisent `player.team` une seule fois par
joueur (`stats.teamCode`, `stats.category`) — un instantané de l'équipe *actuelle*, pas
un historique. Ce résultat est mis en cache puis réutilisé quasiment partout dans
l'application (fiche joueur, listes joueurs/évaluations, temps de jeu, tags des alertes,
export CSV, recherche globale). Pour tout ce qui est **affichage de l'effectif actuel**,
c'est le comportement voulu. Le point à surveiller est isolé plus bas (Bucket D).

## Buckets

### A — Affichage effectif / tableau de profondeur (légitime, aucune action)
Fiche équipe, listes joueurs, temps de jeu, disponibilités, wellness, recherche globale,
export CSV, tags des alertes, `WeekendBoard`/`week-end` (badge informatif quand l'équipe
du week-end diffère de l'équipe habituelle — c'est précisément l'affichage "réel vs
nominal" voulu par la spec), profil parent. Tous lisent `player.teamId`/`player.team`
comme "à quelle équipe ce joueur appartient-il en ce moment", ce qui est correct pour ces
écrans.

### B — Scoping / permissions (légitime, aucune action)
`changeTeam`/`changeStatus`/`updatePlayer`/`declareUnavailability`/`setArchived`/
`createPlayer`/`importPlayers`/évaluations/matériel (contrôle "ce coach gère-t-il
l'équipe administrative de ce joueur"), filtrage des listes/dashboard/alertes/synthèse par
périmètre du staff (`scope.includes(player.teamId)`), scoping séance
(`session-scope.ts`, `availability.ts` — un joueur "concerne" une séance si
`player.teamId === session.scopeTeamId` ou même catégorie), scoping espace parent
(`parent-scope.ts`, `parent-session.ts`, ciblage `StaffAnnouncement`). Usage cohérent et
voulu : ces contrôles portent sur l'appartenance administrative, pas sur un match précis.

### C — Pré-remplissage / valeur par défaut (légitime, à surveiller)
Sélecteurs `<select name="teamId">` à la création (séance, matériel, match, joueur).
Un cas mérite d'être mentionné avec le Bucket D ci-dessous : la liste de candidats
"+ Ajouter un joueur (exception)" sur `matchs/[id]/page.tsx` (convocation/composition).

### D — Attribution historique / match précis (à risque — cibles pour une future phase)
Ce sont les usages où `Player.teamId` sert à répondre à "quelle équipe ce joueur
a-t-il jouée ce jour-là", alors que la vraie réponse existe ailleurs dans le modèle :

- **`src/lib/stats.ts`** (`teamMinutesTotals`, `teamAvgMinutes`, `ecart`, `trend`) — la
  moyenne de minutes de l'équipe regroupe la totalité des minutes de chaque joueur sous
  son équipe *actuelle*, y compris les minutes jouées avant un changement de groupe. Un
  joueur transféré en cours de saison compte 100 % de son historique dans la moyenne de
  sa nouvelle équipe, jamais dans celle de l'ancienne — même pour les matchs réellement
  joués sous l'ancien maillot. Alimente `/temps-de-jeu` et les alertes
  (sous-utilisation, surutilisation, décroche).
- **`src/app/parent/(app)/matchs/page.tsx`** ("Matchs à venir" côté parent) — filtre
  `prisma.match.findMany({ where: { teamId: parent.player.teamId } })` : si l'enfant est
  convoqué pour dépanner une autre équipe de sa catégorie ce week-end, ce match
  n'apparaît jamais dans cette liste.
- **`src/app/parent/(app)/page.tsx`** (`weekendMatch`, bandeau d'accueil parent) — même
  filtre exact par `teamId`, avec le même angle mort. À noter : sur cette même page,
  `weekendConvocation` lit correctement `MatchConvocation` sans filtre d'équipe — les
  deux logiques coexistent avec une fiabilité différente selon l'endroit.
- **`src/app/(app)/matchs/[id]/page.tsx`** (liste "+ Ajouter un joueur (exception)" pour
  la convocation/composition) — le vivier de candidats vient de
  `getPlayerStatsByTeam(match.team.code)`, filtré par code d'équipe exact. Or l'action
  serveur sous-jacente (`toggleConvocation` → `assertPlayerOnMatchTeam`) autorise déjà
  tout joueur de la même catégorie, quelle que soit son équipe actuelle. Résultat : un
  joueur éligible au dépannage n'apparaît tout simplement pas dans la liste de suggestion,
  alors que le serveur l'accepterait s'il y figurait. Écart entre ce que l'interface
  propose et ce que le serveur permet réellement.

### E — Changement d'équipe / mouvement d'effectif (légitime — c'est le mécanisme lui-même)
`changeTeam` (met à jour `Player.teamId` + crée un `TeamHistoryEntry`), formulaire
"Changer de groupe", affichage de l'historique des mouvements (`TeamHistoryEntry`),
création/import de joueurs (`teamId` initial + entrée d'historique "Arrivée au club").

### F — Données de seed/démo (hors production)
`seed-data.ts`, `seed-data-dev.ts`.

## Pour une future phase (non traité ici, volontairement)

Si une dépréciation progressive de `Player.teamId` comme source de vérité "match par
match" est engagée un jour, les trois points du Bucket D ci-dessus sont les candidats
naturels, par ordre de risque perçu pour l'utilisateur final :

1. Le vivier de convocation/composition sur `matchs/[id]/page.tsx` (l'écart le plus
   visible : le staff ne voit même pas l'option).
2. Les deux lectures côté espace parent (`matchs/page.tsx`, `page.tsx`) — un parent peut
   manquer l'information qu'un match de son enfant est prévu.
3. Le calcul de moyenne de minutes par équipe dans `stats.ts` — plus subtil, affecte des
   agrégats statistiques plutôt qu'une action bloquante.

Aucun de ces trois points n'a été modifié dans le cadre de cette phase.
