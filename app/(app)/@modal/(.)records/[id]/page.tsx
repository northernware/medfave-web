import { NoteSummary } from "@/components/note-summary";
import { SidePanel } from "@/components/side-panel";

/**
 * A visit note opened from inside the doctor's pages (patient, dashboard):
 * a side panel over the page. Opened directly or reloaded, `/records/[id]` is
 * the full page.
 */
export default async function NotePanel({ params }: PageProps<"/records/[id]">) {
  const { id } = await params;
  return (
    <SidePanel title="Visit note">
      <NoteSummary id={id} />
    </SidePanel>
  );
}
