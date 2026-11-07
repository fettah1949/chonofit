import { mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

const KEEP_DAYS = 14;
const ZONE = "Africa/Casablanca";
const NAME = /^backup-(\d{4}-\d{2}-\d{2})\.db$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const globalJob = globalThis as unknown as {
  chronoBackupJob?: { started: boolean; running: boolean; timer?: ReturnType<typeof setTimeout> };
};

function moroccoParts(date: Date) {
  const list = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(list.find((part) => part.type === type)?.value ?? "0");
  const hour = value("hour");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: hour === 24 ? 0 : hour,
    minute: value("minute"),
    second: value("second"),
  };
}

export function moroccoDateKey(date = new Date()) {
  const part = moroccoParts(date);
  return `${part.year}-${String(part.month).padStart(2, "0")}-${String(part.day).padStart(2, "0")}`;
}

function offsetMs(instant: Date) {
  const part = moroccoParts(instant);
  const asUtc = Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
  return asUtc - (instant.getTime() - instant.getMilliseconds());
}

function midnightUtc(year: number, month: number, day: number) {
  let utc = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const midnight = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs(new Date(utc));
    if (midnight === utc) return midnight;
    utc = midnight;
  }
  return utc;
}

export function nextMoroccoMidnight(now = new Date()) {
  const part = moroccoParts(now);
  let utc = midnightUtc(part.year, part.month, part.day + 1);
  if (utc <= now.getTime()) {
    const later = moroccoParts(new Date(now.getTime() + 36 * 60 * 60 * 1000));
    utc = midnightUtc(later.year, later.month, later.day);
  }
  return utc;
}

function calendarDaysAfter(olderKey: string, newerKey: string) {
  const [year, month, day] = olderKey.split("-").map(Number);
  const [nextYear, nextMonth, nextDay] = newerKey.split("-").map(Number);
  return Math.round((Date.UTC(nextYear, nextMonth - 1, nextDay) - Date.UTC(year, month - 1, day)) / DAY_MS);
}

export async function backupDatabase() {
  const job = globalJob.chronoBackupJob ?? { started: false, running: false };
  globalJob.chronoBackupJob = job;
  if (job.running) return;
  job.running = true;
  try {
    const directory = path.join(process.cwd(), "backups");
    await mkdir(directory, { recursive: true });
    const today = moroccoDateKey();
    const target = path.join(directory, `backup-${today}.db`);
    const files = await readdir(directory);
    if (!files.includes(`backup-${today}.db`)) {
      const sqlPath = target.replaceAll("\\", "/").replaceAll("'", "''");
      await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
      console.info(`Copie de la base enregistrée : backup-${today}.db`);
    }
    await Promise.all(
      files.map(async (name) => {
        const match = NAME.exec(name);
        if (!match || calendarDaysAfter(match[1], today) <= KEEP_DAYS) return;
        await unlink(path.join(directory, name)).catch(() => undefined);
      }),
    );
  } finally {
    job.running = false;
  }
}

function scheduleNextBackup() {
  const job = globalJob.chronoBackupJob;
  if (!job) return;
  const delay = Math.max(1000, nextMoroccoMidnight() - Date.now());
  job.timer = setTimeout(() => {
    void backupDatabase()
      .catch((error) => {
        console.error("Copie de la base impossible", error);
      })
      .finally(scheduleNextBackup);
  }, delay);
}

export function startDailyBackup() {
  if (globalJob.chronoBackupJob?.started) return;
  globalJob.chronoBackupJob = { started: true, running: false };
  const delay = Math.max(1000, nextMoroccoMidnight() - Date.now());
  console.info(`Copie de la base prévue chaque jour à 00:00, heure du Maroc. Prochaine dans ${Math.round(delay / 60000)} min.`);
  void backupDatabase().catch((error) => {
    console.error("Copie de la base impossible", error);
  });
  scheduleNextBackup();
}
