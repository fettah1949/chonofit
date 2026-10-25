export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-secondary" />
    </div>
  );
}
