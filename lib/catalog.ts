import type { PrismaClient } from "@prisma/client";

const KARATE_YOUNG = "1=18:30-19:30,3=18:30-19:30,5=18:30-19:30";
const KARATE_OLDER = "1=19:30-20:30,3=19:30-20:30,5=19:30-20:30";
const KICK_YOUNG = "2=18:30-19:30,4=18:30-19:30,6=18:30-19:30";
const KICK_OLDER = "2=19:30-20:30,4=19:30-20:30,6=19:30-20:30";

const CATALOG = {
  activities: [
    { code: "KARATE", name: "Karaté", sortOrder: 1 },
    { code: "KICK", name: "Kickboxing", sortOrder: 2 },
  ],
  groups: [
    { code: "KARATE-1", activity: "KARATE", name: "Séance 1", days: KARATE_YOUNG, ageMin: 7, ageMax: 10, sortOrder: 1 },
    { code: "KARATE-2", activity: "KARATE", name: "Séance 2", days: KARATE_OLDER, ageMin: 11, ageMax: 15, sortOrder: 2 },
    { code: "KICK-1", activity: "KICK", name: "Séance 3", days: KICK_YOUNG, ageMin: 7, ageMax: 10, sortOrder: 1 },
    { code: "KICK-2", activity: "KICK", name: "Séance 4", days: KICK_OLDER, ageMin: 11, ageMax: 15, sortOrder: 2 },
  ],
  packs: [
    { code: "PACK-KICK", activity: "KICK", name: "Pack Kick", price: 350, sortOrder: 1 },
    { code: "PACK-KARATE", activity: "KARATE", name: "Pack Karaté", price: 150, sortOrder: 1 },
  ],
  items: [
    { code: "KICK-GANTS", pack: "PACK-KICK", activity: "KICK", name: "Gants", price: 130, sortOrder: 1 },
    { code: "KICK-TENUE", pack: "PACK-KICK", activity: "KICK", name: "Tenue", price: 170, sortOrder: 2 },
    { code: "KICK-TIBIA", pack: "PACK-KICK", activity: "KICK", name: "Protège-tibia", price: 80, sortOrder: 3 },
    { code: "KICK-DENTS", pack: "PACK-KICK", activity: "KICK", name: "Protège-dents", price: 20, sortOrder: 4 },
    { code: "KICK-BANDE", pack: "PACK-KICK", activity: "KICK", name: "Bande", price: 20, sortOrder: 5 },
    { code: "KARATE-TENUE", pack: "PACK-KARATE", activity: "KARATE", name: "Tenue", price: 150, sortOrder: 1 },
    { code: "KARATE-BANDES", pack: "PACK-KARATE", activity: "KARATE", name: "Bandes", price: 20, sortOrder: 2 },
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

export async function ensureCatalog(db: PrismaClient, refresh = false) {
  for (const activity of CATALOG.activities) {
    await db.activity.upsert({
      where: { code: activity.code },
      update: { name: activity.name, sortOrder: activity.sortOrder },
      create: activity,
    });
  }

  const activities = await db.activity.findMany();
  const activityId = new Map(activities.map((activity) => [activity.code, activity.id]));

  const [groupCount, packCount, itemCount] = await Promise.all([
    db.trainingGroup.count(),
    db.equipmentPack.count(),
    db.equipmentItem.count(),
  ]);
  for (const group of CATALOG.groups) {
    const parent = activityId.get(group.activity);
    if (!parent) continue;
    const data = {
      name: group.name,
      days: group.days,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      sortOrder: group.sortOrder,
      activityId: parent,
    };
    if (refresh) {
      await db.trainingGroup.upsert({
        where: { code: group.code },
        update: data,
        create: { code: group.code, ...data },
      });
    } else if (groupCount === 0) {
      await db.trainingGroup.create({ data: { code: group.code, ...data } });
    }
  }

  for (const pack of CATALOG.packs) {
    const parent = activityId.get(pack.activity);
    if (!parent) continue;
    const data = {
      name: pack.name,
      price: pack.price,
      sortOrder: pack.sortOrder,
      activityId: parent,
    };
    if (refresh || packCount === 0) {
      await db.equipmentPack.upsert({
        where: { code: pack.code },
        update: refresh ? data : {},
        create: { code: pack.code, ...data },
      });
    }
  }

  const packs = await db.equipmentPack.findMany();
  const packId = new Map(packs.map((pack) => [pack.code, pack.id]));

  for (const item of CATALOG.items) {
    const parent = activityId.get(item.activity);
    const pack = packId.get(item.pack);
    if (!parent || !pack) continue;
    const data = {
      name: item.name,
      price: item.price,
      sortOrder: item.sortOrder,
      activityId: parent,
      packId: pack,
    };
    if (refresh || itemCount === 0) {
      await db.equipmentItem.upsert({
        where: { code: item.code },
        update: refresh ? data : {},
        create: { code: item.code, ...data },
      });
    }
  }
}
