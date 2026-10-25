import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-12 w-auto",
  md: "h-16 w-auto",
  nav: "h-auto w-full",
  lg: "h-auto w-full max-w-sm",
};

export function ChronoLogo({
  className,
  tone = "light",
  size = "md",
}: {
  className?: string;
  tone?: "light" | "dark";
  size?: keyof typeof sizes;
}) {
  const src = tone === "light" ? "/brand/chrono-light.png" : "/brand/chrono-dark.png";

  return <img src={src} alt="Chrono Fitness" className={cn("object-contain", sizes[size], className)} />;
}
