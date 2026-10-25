import { mkdir, readdir, unlink } from "fs/promises";
import path from "path";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";

const KEEP_DAYS = 14;
const NAME = /^backup-(\d{4}-\d{2}-\d{2})\.db$/;

export async function backupDatabase() {
  const directory = path.join(process.cwd(), "backups");
  await mkdir(directory, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(directory, `backup-${today}.db`);
  const files = await readdir(directory);
  if (!files.includes(`backup-${today}.db`)) {
    const sqlPath = target.replaceAll("\\", "/").replaceAll("'", "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);
  }
  const now = new Date();
  await Promise.all(
    files.map(async (name) => {
      const match = NAME.exec(name);
      if (!match) return;
      const day = new Date(`${match[1]}T12:00:00`);
      if (differenceInCalendarDays(now, day) <= KEEP_DAYS) return;
      await unlink(path.join(directory, name)).catch(() => undefined);
    }),
  );
}
