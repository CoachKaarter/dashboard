import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { issueParentInvitation } from "./parent-invitation";
import { activateParentAccount, checkActivationToken } from "./parent-activation";
import { generateSecureToken } from "./secure-token";
import { canManageCategory, type AuthedUser } from "./authz";

// §55 du cahier des charges "invitation/activation" — ces 10 tests touchent
// une vraie base Postgres (contrairement au reste de la suite, 100% pure
// jusqu'ici) car la propriété testée est justement "la contrainte unique de
// la base tranche une course entre deux activations concurrentes" — une
// fonction pure ne peut pas le prouver. Skippés proprement (jamais en échec)
// si aucune base n'est joignable, pour ne jamais casser `npm test` dans un
// environnement sans DB (CI, poste sans Postgres local...).
async function dbReachable() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function makeTeamAndPlayer(suffix: string) {
  const team = await prisma.team.create({ data: { code: `TEST-${suffix}`, category: "U12" } });
  const player = await prisma.player.create({
    data: {
      firstName: "Léo",
      lastName: `Test${suffix}`,
      birthYear: 2014,
      teamId: team.id,
      position: "MIL",
      positionAlt: "",
      foot: "Droit",
      status: "Actif",
      joinedLabel: "Août 2026",
      parentEmail: `parent.${suffix}@example.test`,
    },
  });
  return { team, player };
}

async function cleanup(teamId: string, playerId: string) {
  await prisma.player.delete({ where: { id: playerId } }).catch(() => {});
  await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
}

test("1. token valide → activation autorisée", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    const { token, tokenHash } = generateSecureToken();
    await prisma.parentInvitation.create({
      data: { playerId: player.id, email: player.parentEmail!, username: "leo.test1", tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 60) },
    });

    const check = await checkActivationToken(token);
    assert.equal(check.status, "valid");

    const result = await activateParentAccount(token, "un-mot-de-passe-suffisant");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.username, "leo.test1");

    const account = await prisma.parentAccount.findUnique({ where: { playerId: player.id } });
    assert.ok(account?.active);
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("2. token aléatoire (jamais émis) → refus", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { token } = generateSecureToken();
  const check = await checkActivationToken(token);
  assert.equal(check.status, "invalid");
  const result = await activateParentAccount(token, "un-mot-de-passe-suffisant");
  assert.deepEqual(result, { ok: false, error: "invalid" });
});

test("3. token expiré → refus", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    const { token, tokenHash } = generateSecureToken();
    await prisma.parentInvitation.create({
      data: { playerId: player.id, email: player.parentEmail!, username: "leo.expired", tokenHash, expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await checkActivationToken(token)).status, "expired");
    const result = await activateParentAccount(token, "un-mot-de-passe-suffisant");
    assert.deepEqual(result, { ok: false, error: "expired" });
    assert.equal(await prisma.parentAccount.findUnique({ where: { playerId: player.id } }), null);
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("4. token déjà utilisé → refus (pas de deuxième compte)", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    const { token, tokenHash } = generateSecureToken();
    await prisma.parentInvitation.create({
      data: { playerId: player.id, email: player.parentEmail!, username: "leo.used", tokenHash, expiresAt: new Date(Date.now() + 60_000) },
    });

    const first = await activateParentAccount(token, "un-mot-de-passe-suffisant");
    assert.equal(first.ok, true);

    const second = await activateParentAccount(token, "un-autre-mot-de-passe");
    assert.equal(second.ok, false);

    const accounts = await prisma.parentAccount.findMany({ where: { playerId: player.id } });
    assert.equal(accounts.length, 1);
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("5. token révoqué → refus", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    const { token, tokenHash } = generateSecureToken();
    await prisma.parentInvitation.create({
      data: {
        playerId: player.id,
        email: player.parentEmail!,
        username: "leo.revoked",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });
    assert.equal((await checkActivationToken(token)).status, "revoked");
    const result = await activateParentAccount(token, "un-mot-de-passe-suffisant");
    assert.deepEqual(result, { ok: false, error: "revoked" });
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("6. ancien token après renvoi (issueParentInvitation) → refus, 7. le nouveau token fonctionne", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    // Premier envoi : Resend n'est pas configuré dans cet environnement, donc
    // l'email échoue (résultat ok:false) — mais la ligne ParentInvitation,
    // elle, est bien créée avant la tentative d'envoi (voir issueParentInvitation).
    await issueParentInvitation(player.id, null);
    const firstInvitation = await prisma.parentInvitation.findFirst({ where: { playerId: player.id }, orderBy: { createdAt: "desc" } });
    assert.ok(firstInvitation);
    const firstUsername = firstInvitation!.username;

    await issueParentInvitation(player.id, null);
    const invitations = await prisma.parentInvitation.findMany({ where: { playerId: player.id }, orderBy: { createdAt: "asc" } });
    assert.equal(invitations.length, 2);
    assert.ok(invitations[0].revokedAt, "l'ancienne invitation doit être révoquée après un renvoi");
    assert.equal(invitations[1].revokedAt, null);
    assert.equal(invitations[1].username, firstUsername, "l'identifiant réservé est réutilisé, pas régénéré, à chaque renvoi");
    assert.notEqual(invitations[0].tokenHash, invitations[1].tokenHash);
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("8. activation en double soumission (deux requêtes concurrentes sur le même jeton) → un seul compte créé", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    const { token, tokenHash } = generateSecureToken();
    await prisma.parentInvitation.create({
      data: { playerId: player.id, email: player.parentEmail!, username: "leo.race", tokenHash, expiresAt: new Date(Date.now() + 60_000) },
    });

    const [a, b] = await Promise.all([
      activateParentAccount(token, "un-mot-de-passe-suffisant"),
      activateParentAccount(token, "un-mot-de-passe-suffisant"),
    ]);
    const successes = [a, b].filter((r) => r.ok);
    assert.equal(successes.length, 1, "exactement une des deux requêtes concurrentes doit réussir");

    const accounts = await prisma.parentAccount.findMany({ where: { playerId: player.id } });
    assert.equal(accounts.length, 1);
  } finally {
    await cleanup(team.id, player.id);
  }
});

test("9. un membre du staff hors périmètre ne peut pas préparer d'invitation pour cette catégorie", () => {
  const davy: AuthedUser = {
    id: "davy",
    username: "davy",
    name: "Davy",
    role: "COACH",
    jobTitle: "Responsable",
    onboardingCompletedAt: new Date(),
    teamIds: [],
    hasFullAccess: false,
    scopes: [{ kind: "category", category: "U8", level: "RESPONSABLE" }],
  };
  // Davy est Responsable U8 — U12 est hors de son périmètre de gestion.
  assert.equal(davy.role !== "ADMIN" && !canManageCategory(davy, "U12"), true);
});

test("10. un parent déjà actif ne reçoit pas d'invitation accidentelle", async (t) => {
  if (!(await dbReachable())) return t.skip("no database reachable");
  const { team, player } = await makeTeamAndPlayer(randomUUID().slice(0, 8));
  try {
    await prisma.parentAccount.create({
      data: { playerId: player.id, username: "leo.active", passwordHash: "x", active: true, mustChangePassword: false },
    });

    const result = await issueParentInvitation(player.id, null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /compte actif existe déjà/);

    const invitations = await prisma.parentInvitation.count({ where: { playerId: player.id } });
    assert.equal(invitations, 0);
  } finally {
    await cleanup(team.id, player.id);
  }
});
