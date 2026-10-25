import { formatMoney } from "@/lib/format";
import { roundMoney } from "@/lib/utils";

type SaleLine = { id: string; name: string; count: number; amount: number; activity?: string };

export function SaleBars({
  items,
  currency,
  noun,
}: {
  items: SaleLine[];
  currency: string;
  noun: "pièce" | "formule";
}) {
  const groups = new Map<string, { title: string; count: number; amount: number; items: SaleLine[] }>();
  for (const item of items) {
    const title = item.activity ?? "";
    const group = groups.get(title) ?? { title, count: 0, amount: 0, items: [] };
    group.count += item.count;
    group.amount = roundMoney(group.amount + item.amount);
    group.items.push(item);
    groups.set(title, group);
  }
  const ordered = [...groups.values()].sort(
    (left, right) => right.amount - left.amount || left.title.localeCompare(right.title, "fr"),
  );
  const max = Math.max(...items.map((item) => item.amount));

  return (
    <div className="mt-4 space-y-5">
      {ordered.map((group) => (
        <div key={group.title || "lignes"}>
          {group.title ? (
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">{group.title}</h3>
              <p className="text-xs text-muted-foreground">
                {formatMoney(group.amount, currency)} · {unitLabel(group.count, noun)}
              </p>
            </div>
          ) : null}
          <ul className={group.title ? "mt-2 space-y-2.5" : "space-y-2.5"}>
            {group.items.map((item) => {
              const width = max > 0 ? Math.max(item.amount > 0 ? 2 : 0, (item.amount / max) * 100) : 0;
              return (
                <li key={item.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="text-muted-foreground">× {item.count}</span>
                      <span className="ml-3 font-medium">{formatMoney(item.amount, currency)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function unitLabel(count: number, noun: "pièce" | "formule") {
  if (noun === "formule") return count > 1 ? `${count} formules` : "1 formule";
  return count > 1 ? `${count} pièces` : "1 pièce";
}
