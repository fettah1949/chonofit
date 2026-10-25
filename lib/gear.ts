import { roundMoney } from "@/lib/utils";

export type GearLine = { id: string; packId: string; price: number };
export type GearPackPrice = { id: string; price: number };

export function gearCharge(items: GearLine[], packs: GearPackPrice[], selectedIds: string[], ownedIds: string[] = []) {
  const owned = new Set(ownedIds);
  const freshIds = new Set(selectedIds.filter((id) => !owned.has(id)));
  const packPrice = new Map(packs.map((pack) => [pack.id, pack.price]));
  const unitPrices = new Map<string, number>();
  let total = 0;

  const chosenByPack = new Map<string, GearLine[]>();
  for (const item of items) {
    if (!freshIds.has(item.id)) continue;
    const chosen = chosenByPack.get(item.packId) ?? [];
    chosen.push(item);
    chosenByPack.set(item.packId, chosen);
  }

  for (const [packId, chosen] of chosenByPack) {
    const packItems = items.filter((item) => item.packId === packId);
    const price = packPrice.get(packId);
    if (price !== undefined && isCompletePack(packItems, freshIds)) {
      total += price;
      for (const [id, unit] of allocatePackPrice(chosen, price)) unitPrices.set(id, unit);
    } else {
      for (const item of chosen) {
        const unit = roundMoney(item.price);
        total += unit;
        unitPrices.set(item.id, unit);
      }
    }
  }

  return { total: roundMoney(total), unitPrices };
}

export function packQuote(packItems: GearLine[], packPrice: number, selectedIds: string[], ownedIds: string[] = []) {
  const owned = new Set(ownedIds);
  const fresh = packItems.filter((item) => selectedIds.includes(item.id) && !owned.has(item.id));
  const complete = isCompletePack(packItems, new Set(fresh.map((item) => item.id)));
  const amount = fresh.length === 0 || complete ? packPrice : roundMoney(fresh.reduce((sum, item) => sum + item.price, 0));
  return { amount, complete, count: fresh.length };
}

function isCompletePack(packItems: GearLine[], freshIds: Set<string>) {
  return packItems.length > 1 && packItems.every((item) => freshIds.has(item.id));
}

function allocatePackPrice(items: GearLine[], packPrice: number) {
  const result = new Map<string, number>();
  if (items.length === 0) return result;
  const target = roundMoney(packPrice);
  const sum = items.reduce((total, item) => total + item.price, 0);
  let used = 0;
  items.forEach((item, index) => {
    const last = index === items.length - 1;
    const unit = last
      ? roundMoney(target - used)
      : sum <= 0
        ? roundMoney(target / items.length)
        : roundMoney((item.price / sum) * target);
    used = roundMoney(used + unit);
    result.set(item.id, unit);
  });
  return result;
}
