export type WhatsAppLinkStatus = {
  status: "disconnected" | "connecting" | "qr" | "open";
  qr: string | null;
  phone: string | null;
  error?: string;
};

export function whatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `212${digits.slice(1)}`;
  return digits;
}

export function renewalWhatsAppMessage(input: {
  gymName: string;
  firstName: string;
  planName: string;
  endLabel: string;
  days: number;
}) {
  const when =
    input.days < 0
      ? `s'est terminé le ${input.endLabel}`
      : input.days === 0
        ? "se termine aujourd'hui"
        : input.days === 1
          ? `se termine demain, le ${input.endLabel}`
          : `se termine dans ${input.days} jours, le ${input.endLabel}`;
  return [
    `Bonjour ${input.firstName},`,
    `Votre abonnement ${input.planName} chez ${input.gymName} ${when}.`,
    "Passez à l'accueil pour le renouveler.",
  ].join("\n");
}

export function whatsAppHref(phone: string, message = "") {
  const international = whatsAppPhone(phone);
  if (!international) return null;
  if (!message) return `https://wa.me/${international}`;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
