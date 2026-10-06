import { requireDoctor } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DOCTOR_LINKS } from "@/components/nav-links";

export default async function AppLayout({ children, modal }: LayoutProps<"/"> & { modal: React.ReactNode }) {
  // A convenience gate for the whole section. Every query and action re-checks
  // on its own — a layout guard alone would not protect direct POSTs.
  const doctor = await requireDoctor();

  return (
    <AppShell
      home="/dashboard"
      links={DOCTOR_LINKS}
      clinic={{ id: doctor.clinicId, name: doctor.clinicName, role: "Doctor" }}
      views={["doctor", "desk"]}
      settingsHref="/manage"
      view="doctor"
      wide
      person={{ name: doctor.fullName, detail: doctor.specialty ?? doctor.email }}>
      {children}
      {/* A visit note opened from these pages, as a side panel (@modal). */}
      {modal}
    </AppShell>
  );
}
