export function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function memberTextMatches(
  member: { firstName: string; lastName: string; phone: string; phone2?: string | null; email?: string | null },
  query: string,
  options?: { email?: boolean },
) {
  const folded = fold(query.trim());
  if (!folded) return true;
  const compact = folded.replace(/\s+/g, "");
  const name = fold(`${member.firstName} ${member.lastName}`);
  const phone = member.phone.replace(/\s+/g, "");
  const phone2 = (member.phone2 ?? "").replace(/\s+/g, "");
  const email = fold(member.email ?? "");
  return (
    name.includes(folded) ||
    phone.includes(compact) ||
    (phone2.length > 0 && phone2.includes(compact)) ||
    (options?.email !== false && email.length > 0 && email.includes(folded))
  );
}
