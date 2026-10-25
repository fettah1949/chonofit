import { avatarColor, cn, initials } from "@/lib/utils";

export function MemberAvatar({
  firstName,
  lastName,
  photoPath,
  className,
}: {
  firstName: string;
  lastName: string;
  photoPath?: string | null;
  className?: string;
}) {
  if (photoPath) {
    return (
      <img
        src={photoPath}
        alt={`${firstName} ${lastName}`}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center font-display font-semibold text-white", className)}
      style={{ backgroundColor: avatarColor(`${firstName}${lastName}`) }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
