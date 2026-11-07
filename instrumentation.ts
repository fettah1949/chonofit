export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutomaticReminders } = await import("@/lib/reminders");
    const { startDailyBackup } = await import("@/lib/backup");
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    startAutomaticReminders();
    startDailyBackup();
  }
}
