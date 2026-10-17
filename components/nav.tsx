"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Buildings2Icon } from "@solar-icons/react/linear/buildings-2";
import { CalendarIcon } from "@solar-icons/react/linear/calendar";
import { CalendarMarkIcon } from "@solar-icons/react/linear/calendar-mark";
import { ClipboardListIcon } from "@solar-icons/react/linear/clipboard-list";
import { ClockCircleIcon } from "@solar-icons/react/linear/clock-circle";
import { DocumentTextIcon } from "@solar-icons/react/linear/document-text";
import { InboxInIcon } from "@solar-icons/react/linear/inbox-in";
import { NotesIcon } from "@solar-icons/react/linear/notes";
import { SettingsIcon } from "@solar-icons/react/linear/settings";
import { ShieldCheckIcon } from "@solar-icons/react/linear/shield-check";
import { HeartPulseIcon } from "@solar-icons/react/linear/heart-pulse";
import { ChatRoundLikeIcon } from "@solar-icons/react/linear/chat-round-like";
import { UserRoundedIcon } from "@solar-icons/react/linear/user-rounded";
import { UsersGroupRoundedIcon } from "@solar-icons/react/linear/users-group-rounded";
import { UsersGroupTwoRoundedIcon } from "@solar-icons/react/linear/users-group-two-rounded";
import { DOCTOR_LINKS, type IconKey, type NavLink } from "@/components/nav-links";

const ICONS: Record<IconKey, typeof CalendarIcon> = {
  feedback: ChatRoundLikeIcon,
  // Today: one day marked on a calendar (Calendar is the whole month).
  today: CalendarMarkIcon,
  calendar: CalendarIcon,
  appointments: ClipboardListIcon,
  households: UsersGroupTwoRoundedIcon,
  patients: UserRoundedIcon,
  documents: DocumentTextIcon,
  hours: ClockCircleIcon,
  settings: SettingsIcon,
  requests: InboxInIcon,
  clinic: Buildings2Icon,
  details: NotesIcon,
  staff: UsersGroupRoundedIcon,
  admin: ShieldCheckIcon,
  emergency: HeartPulseIcon,
};

export function NavIcon({ name, className = "size-5" }: { name: IconKey; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden />;
}

/** A section's home is active only on itself; the others also on the pages under them. */
function isActive(pathname: string, href: string, home: string) {
  return href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  orientation,
  links = DOCTOR_LINKS,
  home = "/dashboard",
}: {
  orientation: "sidebar" | "bar";
  links?: readonly NavLink[];
  home?: string;
}) {
  const pathname = usePathname();
  // The longest matching link wins, so "/manage/schedule" isn't also "/manage".
  const active = links
    .filter((l) => isActive(pathname, l.href, home))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const item = (link: NavLink) => {
    const on = link.href === active;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={on ? "page" : undefined}
        className={[
          "squircle flex items-center gap-3 py-2 text-sm leading-5 font-medium whitespace-nowrap transition-colors",
          orientation === "sidebar" ? "rounded-lg px-3" : "rounded-full px-3",
          on ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
        ].join(" ")}
      >
        <NavIcon name={link.icon} className="size-5 shrink-0" />
        {link.label}
      </Link>
    );
  };

  if (orientation === "bar") {
    return (
      <nav aria-label="Main" className="flex gap-1.5 overflow-x-auto px-4 pb-3">
        {links.map(item)}
      </nav>
    );
  }

  // Grouped, with a quiet label over each group.
  const groups: { name?: string; links: NavLink[] }[] = [];
  for (const link of links) {
    const last = groups[groups.length - 1];
    if (last && last.name === link.group) last.links.push(link);
    else groups.push({ name: link.group, links: [link] });
  }
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((g, i) => (
        <div key={g.name ?? i} className="space-y-0.5">
          {g.name ? (
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{g.name}</p>
          ) : null}
          {g.links.map(item)}
        </div>
      ))}
    </nav>
  );
}
