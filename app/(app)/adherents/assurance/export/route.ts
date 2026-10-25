import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { membersToInsuranceCsv } from "@/lib/insurance-export";
import { todayInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

const filters: Record<"tous" | "avec" | "sans", Prisma.MemberWhereInput> = {
  tous: {},
  avec: { insuranceConfirmed: true },
  sans: { insuranceConfirmed: false },
};

export async function GET(request: Request) {
  await requireAdmin();
  const asked = new URL(request.url).searchParams.get("filtre");
  const filtre = asked === "avec" || asked === "sans" ? asked : "tous";
  const members = await prisma.member.findMany({
    where: filters[filtre],
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      phone2: true,
      sex: true,
      birthDate: true,
      hasInsurance: true,
      insuranceStart: true,
      insuranceEnd: true,
      insuranceConfirmed: true,
      insuranceConfirmedStart: true,
      insuranceConfirmedEnd: true,
    },
  });
  const filename = `assurance-${filtre}-${todayInput()}.csv`;
  return new Response(membersToInsuranceCsv(members), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
