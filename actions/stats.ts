"use server";

import { seesMoney } from "@/lib/constants";
import { requireUser } from "@/lib/session";
import { getChosenMonthStats, statMonth } from "@/lib/stats";

export async function loadMonthStats(sujet: string, mois: string, annee: string) {
  const user = await requireUser();
  if (!seesMoney(user.role)) return null;
  const chosen = statMonth(mois, annee);
  const stats = await getChosenMonthStats(chosen.start, chosen.end);
  return {
    sujet: sujet === "tenues" ? "tenues" as const : "abonnements" as const,
    label: chosen.label,
    month: chosen.month,
    year: chosen.year,
    subscriptions: stats.subscriptions,
    gear: stats.gear,
  };
}
