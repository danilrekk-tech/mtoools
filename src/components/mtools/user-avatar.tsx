import { avatarColor, initials } from "@/lib/user-visual";

export function UserAvatar({
  name,
  email,
  avatarUrl,
  className = "h-9 w-9",
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? email ?? ""} className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  const bg = avatarColor(email ?? name);
  return (
    <span
      aria-hidden
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ backgroundImage: `linear-gradient(135deg, ${bg}, ${bg}bb)` }}
    >
      {initials(name, email)}
    </span>
  );
}

/** Small colored dot used to mark a department everywhere it is mentioned. */
export function DeptDot({ color, className = "h-2.5 w-2.5" }: { color?: string | null; className?: string }) {
  return <span className={`${className} inline-block shrink-0 rounded-full`} style={{ backgroundColor: color ?? "#64748B" }} />;
}
