import { FullPage } from "@/components/full-page";

/**
 * `/records/new` would otherwise be caught by `(.)records/[id]` as a note
 * called "new". Writing a note is a full page, so load it as one.
 */
export default function NewNoteIsAPage() {
  return <FullPage />;
}
