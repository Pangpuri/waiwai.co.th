export function NewBadge({ label }: { readonly label: string }) {
  return (
    <span className="border-accent text-accent bg-surface inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold motion-safe:animate-pulse">
      <span aria-hidden="true">✦</span>
      {label}
    </span>
  );
}
