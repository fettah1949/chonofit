"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import {
  deleteShopProduct,
  restockShopProduct,
  saveShopProduct,
  searchMembersForShop,
  sellShopProduct,
} from "@/actions/shop";
import { PhotoCapture } from "@/components/members/photo-capture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const LOW_STOCK = 2;

export type ShopProductCard = {
  id: string;
  name: string;
  price: number;
  stock: number;
  photoPath: string | null;
  sales: number;
};

export type ShopSaleRow = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  method: string;
  soldAt: string;
  memberName: string;
};

type Buyer = { id: string; firstName: string; lastName: string; phone: string };

function ProductPhoto({ path }: { path: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-[4/3] bg-secondary">
      {path && !failed ? (
        <img src={path} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sans photo</div>
      )}
    </div>
  );
}

export function ShopDesk({
  currency,
  products,
  sales,
}: {
  currency: string;
  products: ShopProductCard[];
  sales: ShopSaleRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<ShopProductCard | "new" | null>(null);
  const [seller, setSeller] = useState<ShopProductCard | null>(null);
  const [restock, setRestock] = useState<ShopProductCard | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditor("new")}>Nouveau produit</Button>
      </div>
      {products.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-sm text-muted-foreground">
          Aucun produit. Ajoutez une ceinture, un kimono, ou un autre article du rayon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const empty = product.stock === 0;
            const low = product.stock > 0 && product.stock <= LOW_STOCK;
            return (
              <article key={product.id} className="overflow-hidden rounded-2xl border bg-card">
                <ProductPhoto path={product.photoPath} />
                <div className="space-y-3 p-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">{product.name}</h2>
                    <p className="text-sm text-muted-foreground">{formatMoney(product.price, currency)}</p>
                    <p className={cn("mt-1 text-sm font-medium", empty ? "text-destructive" : low ? "text-amber-800" : "text-foreground")}>
                      {empty ? "Rupture" : `${product.stock} en réserve`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button className="h-12 flex-1" disabled={empty} onClick={() => setSeller(product)}>
                      {empty ? "Rupture" : "Vendre"}
                    </Button>
                    <Button variant="outline" className="h-12" onClick={() => setRestock(product)}>
                      + stock
                    </Button>
                    <Button variant="outline" className="h-12" onClick={() => setEditor(product)}>
                      Modifier
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <section className="rounded-2xl border bg-card">
        <h2 className="border-b px-4 py-3 font-medium">Dernières ventes</h2>
        {sales.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Aucune vente pour le moment.</p>
        ) : (
          <div className="divide-y">
            {sales.map((sale) => (
              <a key={sale.id} href={`/boutique/${sale.id}/recu`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/70">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {sale.productName} × {sale.quantity}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {sale.memberName} · {formatDateTime(sale.soldAt)} · {METHOD_LABELS[sale.method as PaymentMethod] ?? sale.method}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium">{formatMoney(sale.unitPrice * sale.quantity, currency)}</p>
              </a>
            ))}
          </div>
        )}
      </section>
      <ProductDialog
        editor={editor}
        pending={pending}
        onClose={() => setEditor(null)}
        onSave={(input) => {
          startTransition(async () => {
            const result = await saveShopProduct(input);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            toast.success(result?.success ?? "Produit enregistré.");
            setEditor(null);
            router.refresh();
          });
        }}
        onDelete={(id) => {
          startTransition(async () => {
            const result = await deleteShopProduct(id);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            toast.success(result?.success ?? "Produit supprimé.");
            setEditor(null);
            router.refresh();
          });
        }}
      />
      <SellDialog
        product={seller}
        currency={currency}
        pending={pending}
        onClose={() => setSeller(null)}
        onSell={(input) => {
          startTransition(async () => {
            const result = await sellShopProduct(input);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            if (result?.redirectTo) router.push(result.redirectTo);
          });
        }}
      />
      <RestockDialog
        product={restock}
        pending={pending}
        onClose={() => setRestock(null)}
        onAdd={(id, quantity) => {
          startTransition(async () => {
            const result = await restockShopProduct(id, quantity);
            if (result?.error) {
              toast.error(result.error);
              return;
            }
            toast.success(result?.success ?? "Stock mis à jour.");
            setRestock(null);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function ProductDialog({
  editor,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  editor: ShopProductCard | "new" | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: { id?: string; name: string; price: string; stock?: string; photoPath: string }) => void;
  onDelete: (id: string) => void;
}) {
  const product = editor && editor !== "new" ? editor : null;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [photoPath, setPhotoPath] = useState("");
  const [seen, setSeen] = useState<ShopProductCard | "new" | null>(null);
  if (editor !== seen) {
    setSeen(editor);
    setName(product?.name ?? "");
    setPrice(product ? String(product.price) : "");
    setStock("1");
    setPhotoPath(product?.photoPath ?? "");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      id: product?.id,
      name,
      price,
      stock: product ? undefined : stock,
      photoPath,
    });
  }

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          <DialogDescription>Photo, nom, prix. La quantité de départ se règle à la création, puis avec + stock.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <PhotoCapture value={photoPath} onChange={setPhotoPath} kind="product" />
          <label className="block space-y-1 text-sm">
            <span>Nom</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} placeholder="Ceinture blanche" />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Prix</span>
            <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" required placeholder="40" />
          </label>
          {product ? null : (
            <label className="block space-y-1 text-sm">
              <span>Quantité en réserve</span>
              <Input value={stock} onChange={(event) => setStock(event.target.value)} inputMode="numeric" required />
            </label>
          )}
          <DialogFooter>
            {product && product.sales === 0 ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => onDelete(product.id)}>
                Supprimer
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SellDialog({
  product,
  currency,
  pending,
  onClose,
  onSell,
}: {
  product: ShopProductCard | null;
  currency: string;
  pending: boolean;
  onClose: () => void;
  onSell: (input: { productId: string; quantity: number; memberId: string; method: string }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<string>("CASH");
  const [query, setQuery] = useState("");
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [searching, startSearch] = useTransition();
  const [seen, setSeen] = useState<string | null>(null);
  if ((product?.id ?? null) !== seen) {
    setSeen(product?.id ?? null);
    setQuantity(1);
    setMethod("CASH");
    setQuery("");
    setBuyers([]);
    setBuyer(null);
  }

  function search(value: string) {
    setQuery(value);
    setBuyer(null);
    if (value.trim().length < 2) {
      setBuyers([]);
      return;
    }
    startSearch(async () => {
      setBuyers(await searchMembersForShop(value));
    });
  }

  const max = product?.stock ?? 1;
  const total = product ? product.price * quantity : 0;

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? `Vendre ${product.name}` : "Vendre"}</DialogTitle>
          <DialogDescription>
            {product ? `${formatMoney(product.price, currency)} · ${product.stock} en réserve` : ""}
          </DialogDescription>
        </DialogHeader>
        {product ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onSell({ productId: product.id, quantity, memberId: buyer?.id ?? "", method });
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Quantité</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-12 w-12" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-display text-xl font-semibold">{quantity}</span>
                <Button type="button" variant="outline" className="h-12 w-12" disabled={quantity >= max} onClick={() => setQuantity((current) => Math.min(max, current + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-right font-display text-2xl font-semibold">{formatMoney(total, currency)}</p>
            <div className="space-y-2">
              <label className="block space-y-1 text-sm">
                <span>Adhérent, si c'est pour lui</span>
                <Input value={buyer ? `${buyer.firstName} ${buyer.lastName}` : query} onChange={(event) => search(event.target.value)} placeholder="Nom ou téléphone" autoComplete="off" />
              </label>
              {buyer ? (
                <button type="button" className="text-sm text-primary underline" onClick={() => { setBuyer(null); setQuery(""); }}>
                  Vente au comptoir
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">{searching ? "Recherche…" : "Sans nom, la vente reste au comptoir."}</p>
              )}
              {!buyer && buyers.length > 0 ? (
                <div className="overflow-hidden rounded-xl border">
                  {buyers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-secondary"
                      onClick={() => {
                        setBuyer(item);
                        setBuyers([]);
                      }}
                    >
                      {item.firstName} {item.lastName}
                      <span className="text-muted-foreground"> · {item.phone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={method === item}
                  onClick={() => setMethod(item)}
                  className={cn("h-10 rounded-xl border px-3 text-sm font-medium", method === item ? "border-primary bg-accent" : "bg-card")}
                >
                  {METHOD_LABELS[item]}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12" disabled={pending}>
                {pending ? "Encaissement…" : "Encaisser"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RestockDialog({
  product,
  pending,
  onClose,
  onAdd,
}: {
  product: ShopProductCard | null;
  pending: boolean;
  onClose: () => void;
  onAdd: (id: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const [seen, setSeen] = useState<string | null>(null);
  if ((product?.id ?? null) !== seen) {
    setSeen(product?.id ?? null);
    setQuantity("1");
  }

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? `Stock de ${product.name}` : "Stock"}</DialogTitle>
          <DialogDescription>
            {product ? `${product.stock} en réserve. Les ventes déjà faites ne changent pas.` : ""}
          </DialogDescription>
        </DialogHeader>
        {product ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              onAdd(product.id, Number(quantity));
            }}
          >
            <label className="block space-y-1 text-sm">
              <span>Pièces à ajouter</span>
              <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" required />
            </label>
            <DialogFooter>
              <Button type="submit" disabled={pending}>{pending ? "Ajout…" : "Ajouter"}</Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
