import type { PrismaClient } from "@prisma/client";

const CATALOG = {
  activities: [
    { code: "KARATE", name: "Karaté", sortOrder: 1 },
    { code: "KICK", name: "Kickboxing", sortOrder: 2 },
  ],
  groups: [
    { code: "KARATE-1", activity: "KARATE", name: "Karaté 1", days: "1,3,5", sortOrder: 1 },
    { code: "KARATE-2", activity: "KARATE", name: "Karaté 2", days: "2,4,6", sortOrder: 2 },
    { code: "KICK-1", activity: "KICK", name: "Kick 1", days: "1,3,5", sortOrder: 1 },
    { code: "KICK-2", activity: "KICK", name: "Kick 2", days: "2,4,6", sortOrder: 2 },
  ],
  packs: [
    { code: "PACK-KICK", activity: "KICK", name: "Pack Kickboxing", price: 350, sortOrder: 1 },
    { code: "PACK-KARATE", activity: "KARATE", name: "Pack Karaté", price: 150, sortOrder: 1 },
  ],
  items: [
    { code: "KICK-TENUE", pack: "PACK-KICK", activity: "KICK", name: "Tenue Kick", price: 200, sortOrder: 1 },
    { code: "KICK-GANTS", pack: "PACK-KICK", activity: "KICK", name: "Gants", price: 100, sortOrder: 2 },
    { code: "KICK-DENTS", pack: "PACK-KICK", activity: "KICK", name: "Protège-dents", price: 50, sortOrder: 3 },
    { code: "KARATE-TENUE", pack: "PACK-KARATE", activity: "KARATE", name: "Tenue Karaté", price: 150, sortOrder: 1 },
  ],
};

export async function loadCatalog(db: PrismaClient) {
  await ensureCatalog(db);
  const [activities, groups, packs, items] = await Promise.all([
    db.activity.findMany({ orderBy: { sortOrder: "asc" } }),
    db.trainingGroup.findMany({ orderBy: [{ activity: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    db.equipmentPack.findMany({ orderBy: [{ activity: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
    db.equipmentItem.findMany({ orderBy: [{ activity: { sortOrder: "asc" } }, { pack: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
  ]);
  return { activities, groups, packs, items };
}

export async function ensureCatalog(db: PrismaClient) {
  for (const activity of CATALOG.activities) {
    await db.activity.upsert({
      where: { code: activity.code },
      update: { name: activity.name, sortOrder: activity.sortOrder },
      create: activity,
    });
  }

  const activities = await db.activity.findMany();
  const activityId = new Map(activities.map((activity) => [activity.code, activity.id]));

  const groupCount = await db.trainingGroup.count();
  if (groupCount === 0) {
    for (const group of CATALOG.groups) {
      const parent = activityId.get(group.activity);
      if (!parent) continue;
      await db.trainingGroup.create({
        data: {
          code: group.code,
          name: group.name,
          days: group.days,
          sortOrder: group.sortOrder,
          activityId: parent,
        },
      });
    }
  }

  for (const pack of CATALOG.packs) {
    const parent = activityId.get(pack.activity);
    if (!parent) continue;
    await db.equipmentPack.upsert({
      where: { code: pack.code },
      update: {},
      create: {
        code: pack.code,
        name: pack.name,
        price: pack.price,
        sortOrder: pack.sortOrder,
        activityId: parent,
      },
    });
  }

  const packs = await db.equipmentPack.findMany();
  const packId = new Map(packs.map((pack) => [pack.code, pack.id]));

  for (const item of CATALOG.items) {
    const parent = activityId.get(item.activity);
    const pack = packId.get(item.pack);
    if (!parent || !pack) continue;
    await db.equipmentItem.upsert({
      where: { code: item.code },
      update: {},
      create: {
        code: item.code,
        name: item.name,
        price: item.price,
        sortOrder: item.sortOrder,
        activityId: parent,
        packId: pack,
      },
    });
  }
}
