import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { GearDesk } from "@/components/shop/gear-desk";
import { ShopDesk } from "@/components/shop/shop-desk";

export const metadata: Metadata = { title: "Boutique" };

export default async function ShopPage() {
  const user = await requireUser();
  if (user.role === "COACH") redirect("/groupes");
  const [products, sales, settings, gearItems, gearSales] = await Promise.all([
    prisma.shopProduct.findMany({
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      include: { _count: { select: { sales: true } } },
    }),
    prisma.shopSale.findMany({
      orderBy: { soldAt: "desc" },
      take: 12,
      include: {
        product: { select: { name: true } },
        member: { select: { firstName: true, lastName: true } },
      },
    }),
    getSettings(),
    prisma.equipmentItem.findMany({
      orderBy: [{ activity: { sortOrder: "asc" } }, { pack: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { pack: { select: { name: true } }, activity: { select: { name: true } } },
    }),
    prisma.equipmentSale.findMany({
      orderBy: { soldAt: "desc" },
      take: 12,
      include: { item: { select: { name: true, pack: { select: { name: true } } } } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Boutique"
        description="Le rayon, puis les tenues du catalogue à l'unité. Une vente de tenue sans inscription ne crée pas d'adhérent."
      />
      <GearDesk
        currency={settings.currency}
        items={gearItems.map((item) => ({
          id: item.id,
          name: item.name,
          packName: item.pack.name,
          activityName: item.activity.name,
          price: item.price,
          stock: item.stock,
        }))}
        sales={gearSales.map((sale) => ({
          id: sale.id,
          itemName: sale.item.name,
          packName: sale.item.pack.name,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          method: sale.method,
          soldAt: sale.soldAt.toISOString(),
        }))}
      />
      <ShopDesk
        currency={settings.currency}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          photoPath: product.photoPath,
          sales: product._count.sales,
        }))}
        sales={sales.map((sale) => ({
          id: sale.id,
          productName: sale.product.name,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          method: sale.method,
          soldAt: sale.soldAt.toISOString(),
          memberName: sale.member ? `${sale.member.firstName} ${sale.member.lastName}` : "Comptoir",
        }))}
      />
    </div>
  );
}
