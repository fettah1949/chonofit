export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutomaticReminders } = await import("@/lib/reminders");
    const { backupDatabase } = await import("@/lib/backup");
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    startAutomaticReminders();
    void backupDatabase().catch((error) => {
      console.error("Copie de la base impossible", error);
    });
  }
}
