import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { withQuery } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  path,
  params,
}: {
  page: number;
  pageCount: number;
  path: string;
  params: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={withQuery(path, { ...params, page: page - 1 })}
          >
            Précédent
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={withQuery(path, { ...params, page: page + 1 })}
          >
            Suivant
          </Link>
        ) : null}
      </div>
    </div>
  );
}
