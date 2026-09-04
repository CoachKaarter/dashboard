"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam, canAccessCategory } from "@/lib/authz";
import { POSITIONS } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { readXlsxFirstSheetGrid, type XlsxCell } from "@/lib/match-import";
import { extractPlayerRows, buildPlayerImportCandidates, type ImportableTeam, type ImportableCategory } from "@/lib/player-import";
import { logActivity } from "@/lib/activity";

// A player belongs to a category, never to a specific team by default — see
// prisma/schema.prisma's Player.category/Player.teamId comments. teamId is
// only ever set here when the staff member explicitly fixes one (still
// validated against the chosen category), never inferred.
export async function createPlayer(formData: FormData) {
  const user = await requireUser();
  const category = String(formData.get("category") ?? "").trim();
  if (!canAccessCategory(user, category)) return;

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const birthYear = Number(formData.get("birthYear"));
  const position = String(formData.get("position") ?? "Non renseigné");
  if (!firstName || !lastName || !birthYear || !category) return;

  const teamIdRaw = String(formData.get("teamId") ?? "").trim();
  let teamId: string | null = null;
  if (teamIdRaw && canAccessTeam(user, teamIdRaw)) {
    const team = await prisma.team.findUnique({ where: { id: teamIdRaw } });
    if (team && team.category === category) teamId = team.id;
  }

  const player = await prisma.player.create({
    data: {
      firstName,
      lastName: lastName.toUpperCase(),
      birthYear,
      category,
      teamId,
      position: POSITIONS.includes(position) ? position : "Non renseigné",
      positionAlt: "Non renseigné",
      foot: "Non renseigné",
      status: "Actif",
      joinedLabel: String(formData.get("joinedLabel") ?? "").trim() || "Saison 2026/2027",
    },
  });
  if (teamId) {
    await prisma.teamHistoryEntry.create({
      data: {
        playerId: player.id,
        toTeamId: teamId,
        date: new Date(),
        reason: "Arrivée au club",
        decidedById: user.id,
      },
    });
  }
  revalidatePath("/joueurs");
  revalidatePath("/equipes");
  redirect(`/joueurs/${player.id}`);
}

// Two-step import: previewPlayerImport parses the file (CSV or .xlsx) and
// returns a row-by-row preview — nothing is written to the DB yet — so the
// user can see duplicates and errors and uncheck rows before committing.
// confirmPlayerImport then creates only the rows still checked, re-reading
// its data from a hidden field the preview step rendered (see
// ImportPreviewClient.tsx) rather than re-uploading the file.
export type PlayerImportPreviewRow = {
  sourceRow: number;
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  firstName?: string;
  lastName?: string;
  category?: string;
  teamId?: string | null;
  teamCode?: string | null;
  birthYear?: number;
  position?: string;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
};
export type PlayerImportPreviewState = { rows: PlayerImportPreviewRow[] } | { error: string } | null;

export async function previewPlayerImport(
  _prev: PlayerImportPreviewState,
  formData: FormData
): Promise<PlayerImportPreviewState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier sélectionné." };

  const fallbackCategoryRaw = String(formData.get("category") || "").trim();
  const fallbackCategory = fallbackCategoryRaw && canAccessCategory(user, fallbackCategoryRaw) ? fallbackCategoryRaw : null;

  let grid: XlsxCell[][];
  try {
    grid = file.name.toLowerCase().endsWith(".xlsx")
      ? readXlsxFirstSheetGrid(Buffer.from(await file.arrayBuffer()))
      : parseCsv(await file.text());
  } catch {
    return { error: "Fichier illisible — un .csv ou .xlsx est attendu." };
  }

  const rawRows = extractPlayerRows(grid);
  if (rawRows.length === 0) {
    return { error: "Aucune ligne reconnue — colonnes attendues : Nom, Prénom." };
  }

  const allTeams = await prisma.team.findMany();
  const teams: ImportableTeam[] = allTeams.map((t) => ({ id: t.id, code: t.code, category: t.category, allowed: canAccessTeam(user, t.id) }));
  const categoryCodes = [...new Set(allTeams.map((t) => t.category))];
  const categories: ImportableCategory[] = categoryCodes.map((c) => ({ code: c, allowed: canAccessCategory(user, c) }));

  const existingPlayers = await prisma.player.findMany({
    where: { archived: false },
    select: { category: true, firstName: true, lastName: true },
  });
  const existingPlayerKeys = new Set(
    existingPlayers.map((p) => `${p.category}|${p.lastName.toUpperCase()}|${p.firstName.toLowerCase()}`)
  );

  const outcomes = buildPlayerImportCandidates(rawRows, { teams, categories, fallbackCategory, existingPlayerKeys });
  const rows: PlayerImportPreviewRow[] = outcomes.map((o) =>
    o.ok
      ? {
          sourceRow: o.sourceRow,
          ok: true,
          duplicate: o.duplicate,
          firstName: o.candidate.firstName,
          lastName: o.candidate.lastName,
          category: o.candidate.category,
          teamId: o.candidate.teamId,
          teamCode: o.candidate.teamCode,
          birthYear: o.candidate.birthYear,
          position: o.candidate.position,
          parentName: o.candidate.parentName,
          parentEmail: o.candidate.parentEmail,
          parentPhone: o.candidate.parentPhone,
        }
      : { sourceRow: o.sourceRow, ok: false, error: o.error }
  );
  return { rows };
}

export async function confirmPlayerImport(formData: FormData) {
  const user = await requireUser();
  let rows: PlayerImportPreviewRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    redirect("/joueurs/importer?error=Donn%C3%A9es+d%27import+invalides");
  }
  const included = new Set(formData.getAll("include").map(Number));

  let imported = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Re-check access server-side — never trust the client-echoed
    // category/teamId on their own, the same rule as every other action
    // taking a submitted id.
    if (!included.has(i) || !r.ok || !r.category || !r.firstName || !r.lastName || !r.birthYear || !canAccessCategory(user, r.category)) {
      skipped++;
      continue;
    }
    const teamId = r.teamId && canAccessTeam(user, r.teamId) ? r.teamId : null;
    const player = await prisma.player.create({
      data: {
        firstName: r.firstName,
        lastName: r.lastName,
        birthYear: r.birthYear,
        category: r.category,
        teamId,
        position: r.position && POSITIONS.includes(r.position) ? r.position : "Non renseigné",
        positionAlt: "Non renseigné",
        foot: "Non renseigné",
        status: "Actif",
        joinedLabel: "Saison 2026/2027",
        parentName: r.parentName || undefined,
        parentEmail: r.parentEmail || undefined,
        parentPhone: r.parentPhone || undefined,
      },
    });
    if (teamId) {
      await prisma.teamHistoryEntry.create({
        data: { playerId: player.id, toTeamId: teamId, date: new Date(), reason: "Import fichier", decidedById: user.id },
      });
    }
    imported++;
  }

  await logActivity({ actorId: user.id, summary: `a importé ${imported} joueur(s) via fichier (${skipped} ignoré(s))`, entityType: "Player" });
  revalidatePath("/joueurs");
  revalidatePath("/equipes");
  redirect(`/joueurs/importer?imported=${imported}&skipped=${skipped}`);
}
