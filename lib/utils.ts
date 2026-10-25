import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function avatarColor(name: string) {
  const colors = ["#1a1a1a", "#e10600", "#3a3a3a", "#8e1d18", "#555555", "#b42318"];
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % colors.length;
  return colors[hash];
}

export function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const message = (
      error as { response?: { data?: { error?: { message?: string } } } }
    ).response?.data?.error?.message;
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return "Une erreur inattendue est survenue.";
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
