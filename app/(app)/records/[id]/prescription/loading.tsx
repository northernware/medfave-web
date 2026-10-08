import { PageSkeleton } from "@/components/page-skeleton";

// The printable prescription, not the note: the plain outline.
export default function Loading() {
  return <PageSkeleton cards={1} />;
}
