"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { createOneAccountBulkAction } from "./actions";
import type { CreateAccountResult } from "@/lib/parent-account-creation";

type EligiblePlayer = { id: string; name: string; email: string };

// Runs at most CONCURRENCY calls at once, one per player — never one giant
// request for all ~96, so a single serverless call always stays small and
// fast, and Resend's rate limit is respected by construction rather than by
// guessing a delay. Also gives real progress feedback, which a single
// blocking request couldn't.
const CONCURRENCY = 3;

export function BulkAccountCreationPanel({ players }: { players: EligiblePlayer[] }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<CreateAccountResult[]>([]);

  async function run() {
    setRunning(true);
    setDone(0);
    setResults([]);

    const queue = [...players];
    const collected: CreateAccountResult[] = [];
    let completed = 0;

    async function worker() {
      while (queue.length > 0) {
        const player = queue.shift();
        if (!player) return;
        const result = await createOneAccountBulkAction(player.id);
        collected.push(result);
        completed++;
        setDone(completed);
        setResults([...collected]);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, players.length) }, () => worker()));
    setRunning(false);
  }

  const sentCount = results.filter((r) => r.ok && r.emailStatus === "sent").length;
  const failedCount = results.filter((r) => r.ok && r.emailStatus === "failed").length;
  const errorCount = results.filter((r) => !r.ok).length;

  return (
    <div className="bg-surface border border-line rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Création en masse</span>
        <span className="flex-1" />
        <span className="text-[11px] text-muted-2">{players.length} en attente</span>
      </div>

      {players.length === 0 && results.length === 0 ? (
        <div className="text-[12.5px] text-muted">Aucun joueur en attente — tous ceux avec un email renseigné ont déjà un compte.</div>
      ) : (
        <>
          {!running && results.length === 0 && (
            <button
              type="button"
              onClick={run}
              disabled={players.length === 0}
              className="h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] disabled:opacity-60"
            >
              Créer les {players.length} compte{players.length === 1 ? "" : "s"} et envoyer les emails
            </button>
          )}

          {running && (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 bg-line-soft rounded-full overflow-hidden">
                <div
                  className="h-full bg-green transition-all duration-200"
                  style={{ width: `${Math.round((100 * done) / players.length)}%` }}
                />
              </div>
              <div className="text-[12px] text-muted">
                {done} / {players.length} traités…
              </div>
            </div>
          )}

          {!running && results.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="text-[12.5px] text-ink-soft">
                {sentCount} email{sentCount === 1 ? "" : "s"} envoyé{sentCount === 1 ? "" : "s"}
                {failedCount > 0 ? ` · ${failedCount} échec${failedCount === 1 ? "" : "s"} d'envoi (identifiants ci-dessous)` : ""}
                {errorCount > 0 ? ` · ${errorCount} erreur${errorCount === 1 ? "" : "s"}` : ""}
              </div>
              <div className="flex flex-col gap-1.5 max-h-[420px] overflow-auto">
                {results.map((r) => (
                  <ResultRow key={r.playerId} result={r} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: CreateAccountResult }) {
  if (!result.ok) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-red-bg text-[12.5px]">
        <span className="text-red font-semibold shrink-0">✕</span>
        <span className="flex-1 min-w-0 truncate">{result.playerName}</span>
        <span className="text-red text-[11.5px]">{result.error}</span>
      </div>
    );
  }

  if (result.emailStatus === "sent") {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-green-bg text-[12.5px]">
        <span className="text-green font-semibold shrink-0">✓</span>
        <span className="flex-1 min-w-0 truncate font-semibold">{result.playerName}</span>
        <span className="font-mono text-[11.5px] text-ink-soft">{result.username}</span>
        <span className="text-green text-[11px] font-semibold">Envoyé</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-orange-bg text-[12.5px] flex-wrap">
      <span className="text-orange font-semibold shrink-0">!</span>
      <span className="flex-1 min-w-0 truncate font-semibold">{result.playerName}</span>
      <span className="font-mono text-[11.5px] text-ink-soft">
        {result.username} / {result.tempPassword}
      </span>
      <CopyButton
        text={`${result.playerName}\nIdentifiant : ${result.username}\nMot de passe temporaire : ${result.tempPassword}`}
        label="Copier"
        className="h-6 px-2 rounded bg-ink text-white text-[10.5px] font-semibold"
      />
    </div>
  );
}
