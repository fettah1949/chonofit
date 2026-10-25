import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fold } from "@/lib/member-match";

const ACCENTS: [string, string][] = [
  ["à", "a"], ["á", "a"], ["â", "a"], ["ä", "a"], ["ã", "a"],
  ["À", "a"], ["Á", "a"], ["Â", "a"], ["Ä", "a"], ["Ã", "a"],
  ["é", "e"], ["è", "e"], ["ê", "e"], ["ë", "e"],
  ["É", "e"], ["È", "e"], ["Ê", "e"], ["Ë", "e"],
  ["î", "i"], ["ï", "i"], ["í", "i"], ["ì", "i"],
  ["Î", "i"], ["Ï", "i"], ["Í", "i"], ["Ì", "i"],
  ["ô", "o"], ["ö", "o"], ["ó", "o"], ["ò", "o"],
  ["Ô", "o"], ["Ö", "o"], ["Ó", "o"], ["Ò", "o"],
  ["ù", "u"], ["û", "u"], ["ü", "u"], ["ú", "u"],
  ["Ù", "u"], ["Û", "u"], ["Ü", "u"], ["Ú", "u"],
  ["ç", "c"], ["Ç", "c"], ["ñ", "n"], ["Ñ", "n"], ["ÿ", "y"], ["Ÿ", "y"],
  ["œ", "oe"], ["Œ", "oe"], ["æ", "ae"], ["Æ", "ae"],
];

function folded(column: string) {
  return ACCENTS.reduce((expr, [from, to]) => `replace(${expr}, '${from}', '${to}')`, `lower(${column})`);
}

const foldedName = `${folded('"firstName"')} || ' ' || ${folded('"lastName"')}`;

function likeContains(value: string) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function memberSearch(query: string): Prisma.MemberWhereInput {
  const q = query.trim();
  const phone = q.replace(/\s+/g, "");
  const parts = q.split(/\s+/).filter(Boolean);
  const or: Prisma.MemberWhereInput[] = [
    { firstName: { contains: q } },
    { lastName: { contains: q } },
    { phone: { contains: phone } },
    { phone2: { contains: phone } },
    { email: { contains: q } },
  ];

  if (parts.length >= 2) {
    or.push(
      {
        AND: [
          { firstName: { contains: parts[0] } },
          { lastName: { contains: parts.slice(1).join(" ") } },
        ],
      },
      {
        AND: [
          { lastName: { contains: parts[0] } },
          { firstName: { contains: parts.slice(1).join(" ") } },
        ],
      },
    );
  }

  return { OR: or };
}

export async function searchMemberIds(
  query: string,
  options?: { email?: boolean; take?: number },
) {
  const foldedQuery = fold(query.trim());
  if (!foldedQuery) return [];
  const nameLike = likeContains(foldedQuery);
  const phoneLike = likeContains(foldedQuery.replace(/\s+/g, ""));
  const emailClause =
    options?.email === false
      ? Prisma.empty
      : Prisma.sql`OR ${Prisma.raw(folded('"email"'))} LIKE ${nameLike} ESCAPE '\\'`;
  const limit = options?.take ? Prisma.sql`LIMIT ${options.take}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Member"
    WHERE ${Prisma.raw(foldedName)} LIKE ${nameLike} ESCAPE '\\'
       OR replace("phone", ' ', '') LIKE ${phoneLike} ESCAPE '\\'
       OR replace("phone2", ' ', '') LIKE ${phoneLike} ESCAPE '\\'
       ${emailClause}
    ORDER BY "lastName" ASC, "firstName" ASC
    ${limit}
  `;
  return rows.map((row) => row.id);
}
