import { z } from "zod";

export const ANNOUNCEMENT_CATEGORIES = ["TERRAIN", "ANNULATION", "WEEKEND", "MESSAGE"] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  TERRAIN: "Changement de terrain",
  ANNULATION: "Annulation",
  WEEKEND: "Week-end",
  MESSAGE: "Message du staff",
};

export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  targetCategory: z.enum(["U12", "U13"]),
  scopeTeamId: z.string().trim().min(1).nullable(),
});
