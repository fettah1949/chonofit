import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/maintenance";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ShopDesk } from "@/components/shop/shop-desk";

export const metadata: Metadata = { title: "Boutique" };

export default async function ShopPage() {
  const user = await requireUser();
  if (user.role === "COACH") redirect("/groupes");
  const [products, sales, settings] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Boutique"
        description="Ceinture, kimono et les autres articles du rayon. Le pack d'inscription n'est pas ici."
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
