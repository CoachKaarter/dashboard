import { forwardRef } from "react";
import type { ConvocationPosterData } from "@/lib/convocation-poster";

// Feuille de convocation — visuel HTML/CSS capturé en PNG (jamais un fichier
// Excel généré). Largeur fixe volontaire (voir POSTER_WIDTH dans le modal
// appelant) : l'export doit être identique quel que soit l'écran d'où il
// est déclenché. Police système (Arial) plutôt que les polices du produit
// (Archivo/Barlow chargées via next/font) — plus sûr pour une capture
// html-to-image, qui ne garantit pas le chargement de web fonts custom.
const NAVY = "#04116C";
const BLUE = "#1A31F6";
const RED = "#EE220B";
const GREY_ROW = "#EBEBEB";
const FONT = "Arial, Helvetica, sans-serif";

export const ConvocationPoster = forwardRef<HTMLDivElement, { data: ConvocationPosterData }>(function ConvocationPoster({ data }, ref) {
  return (
    <div ref={ref} style={{ width: 1600, background: "#FFFFFF", fontFamily: FONT, color: "#16181C" }}>
      <Header data={data} />
      <div style={{ display: "flex", gap: 10, padding: "14px 18px" }}>
        {data.teams.map((team) => (
          <TeamCard key={team.code} team={team} />
        ))}
        <SideColumn data={data} />
      </div>
      <Footer clubName={data.clubName} />
    </div>
  );
});

function Header({ data }: { data: ConvocationPosterData }) {
  return (
    <div style={{ background: NAVY, padding: "18px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      {data.clubLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- capturé par html-to-image, pas servi par Next Image
        <img src={data.clubLogoUrl} alt="" style={{ height: 56, width: 56, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4 }} />
      )}
      <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, letterSpacing: "0.01em", lineHeight: 1.2 }}>{data.title}</div>
    </div>
  );
}

function Footer({ clubName }: { clubName: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ background: RED, color: "#fff", fontWeight: 800, fontSize: 13, textAlign: "center", padding: "8px 12px" }}>
        MERCI DE PRÉVENIR EN CAS D&apos;ABSENCE OU DE RETARD L&apos;ÉDUCATEUR DE L&apos;ÉQUIPE CONCERNÉE
      </div>
      <div style={{ background: NAVY, color: "#fff", fontWeight: 800, fontSize: 12, textAlign: "center", padding: "7px 12px", letterSpacing: "0.04em" }}>
        • {clubName.toUpperCase()} •
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", color: "#9A9DA3", textTransform: "uppercase", marginTop: 8 }}>{children}</div>;
}
function Value({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <div style={{ fontSize: 12.5, fontWeight: bold ? 800 : 600, color: "#16181C", lineHeight: 1.3 }}>{children}</div>;
}
function RedValue({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: RED }}>{children}</div>;
}

function TeamCard({ team }: { team: ConvocationPosterData["teams"][number] }) {
  return (
    <div style={{ flex: 1, minWidth: 0, border: "1px solid #E7E7E2", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: BLUE, color: "#fff", padding: "8px 10px", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{team.code}</div>
      </div>
      <div style={{ padding: "8px 10px 12px", flex: 1 }}>
        {!team.match ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#9A9DA3", fontSize: 13, fontWeight: 700 }}>Pas de match</div>
        ) : (
          <MatchBlock m={team.match} />
        )}
      </div>
    </div>
  );
}

function MatchBlock({ m }: { m: NonNullable<ConvocationPosterData["teams"][number]["match"]> }) {
  return (
    <>
      <Label>Niveau</Label>
      <Value>{m.level}</Value>

      <Label>Date · Type</Label>
      <Value>
        {m.dateLabel} · {m.competition}
      </Value>

      <Label>Adversaire</Label>
      <Value bold>{m.opponent}</Value>

      <Label>Lieu · Surface</Label>
      <Value>
        {m.location} · {m.surface}
      </Value>

      <Label>Adresse</Label>
      <Value>{m.venueAddress}</Value>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <Label>Heure du match</Label>
          <Value bold>{m.time}</Value>
        </div>
        <div style={{ flex: 1 }}>
          <Label>Heure du RDV</Label>
          <Value bold>{m.meetTime}</Value>
        </div>
      </div>
      <Label>Lieu du RDV</Label>
      <Value>{m.meetLocation}</Value>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Label>Fin estimée</Label>
          <Value>{m.estimatedEndTime}</Value>
        </div>
        <div style={{ flex: 1 }}>
          <Label>Retour estimé</Label>
          <Value>{m.estimatedReturnTime}</Value>
        </div>
      </div>

      {m.parentNotes !== "—" && (
        <>
          <div style={{ marginTop: 8, background: RED, color: "#fff", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 6px", borderRadius: 4 }}>
            Informations
          </div>
          <Value>{m.parentNotes}</Value>
        </>
      )}

      <div style={{ marginTop: 10, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "#16181C", borderTop: "1px solid #E7E7E2", paddingTop: 6 }}>
        JOUEURS CONVOQUÉS ({m.players.length})
      </div>
      <div>
        {m.players.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#9A9DA3", padding: "6px 2px" }}>Aucun joueur convoqué</div>
        ) : (
          m.players.map((p) => (
            <div
              key={p.number}
              style={{
                display: "flex",
                gap: 6,
                padding: "3px 4px",
                fontSize: 11.5,
                fontWeight: 700,
                background: p.number % 2 === 0 ? GREY_ROW : "transparent",
                borderRadius: 3,
              }}
            >
              <span style={{ color: "#9A9DA3", minWidth: 16 }}>{p.number}.</span>
              <span>{p.name}</span>
            </div>
          ))
        )}
      </div>

      <Label>Transport</Label>
      <RedValue>{m.transportLabel}</RedValue>

      <Label>Lavage maillots</Label>
      <Value>{m.jersey}</Value>

      <Label>Éducateur(s)</Label>
      <Value>{m.educateurs}</Value>
      <Label>Téléphone</Label>
      <Value>{m.phone}</Value>
      <Label>Dirigeant(s)</Label>
      <Value>{m.dirigeants}</Value>
    </>
  );
}

function SideColumn({ data }: { data: ConvocationPosterData }) {
  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <SideSection title="Absents" names={data.sideColumn.absents} />
      <SideSection title="Non convoqués" names={data.sideColumn.nonConvoques} />
      <SideSection title="Blessés" names={data.sideColumn.blesses} />
    </div>
  );
}

function SideSection({ title, names }: { title: string; names: string[] }) {
  return (
    <div style={{ border: "1px solid #E7E7E2", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: NAVY, color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "7px 10px" }}>
        {title} {names.length > 0 && `(${names.length})`}
      </div>
      <div style={{ padding: "6px 8px" }}>
        {names.length === 0 ? (
          <div style={{ fontSize: 11, color: "#C9CBC7", padding: "3px 2px" }}>—</div>
        ) : (
          names.map((n, i) => (
            <div key={n} style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 4px", background: i % 2 === 1 ? GREY_ROW : "transparent", borderRadius: 3 }}>
              {n}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
