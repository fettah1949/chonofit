import { endOfDay, startOfDay } from "date-fns";

export type StatusInput = {
  status: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

export function isSubscriptionCurrent(subscription: StatusInput, now = new Date()) {
  if (subscription.status !== "ACTIVE") return false;
  if (subscription.startDate && new Date(subscription.startDate) > endOfDay(now)) return false;
  if (!subscription.endDate) return true;
  return new Date(subscription.endDate) >= startOfDay(now);
}

export function memberDisplayStatus(
  member: { status: string; subscriptions: StatusInput[] },
  now = new Date(),
) {
  if (member.status === "SUSPENDED") return "SUSPENDED" as const;
  if (member.subscriptions.some((subscription) => isSubscriptionCurrent(subscription, now))) {
    return "ACTIVE" as const;
  }
  if (member.subscriptions.some((subscription) => subscription.status === "SUSPENDED")) {
    return "SUSPENDED" as const;
  }
  return "EXPIRED" as const;
}

export function currentSubscription<T extends StatusInput & { startDate?: Date | string }>(
  subscriptions: T[],
  now = new Date(),
) {
  return (
    subscriptions.find((subscription) => isSubscriptionCurrent(subscription, now)) ??
    subscriptions[0]
  );
}
