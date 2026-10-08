import type { ReactNode } from "react";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { ActionDialog } from "@/components/action-dialog";
import { buttonClass } from "@/components/ui";
import { statusActionLabel } from "@/lib/domain";
import type { AppointmentStatus } from "@/lib/enums";

/**
 * A visit's next steps as buttons, the expected one first. Cancelling sits
 * apart at the end and asks first: it frees the slot and tells the patient,
 * so it shouldn't be the button beside Check in. `children` go after the
 * steps (Reschedule).
 */
export function VisitMoves({
  appointmentId,
  status,
  moves,
  start,
  children,
}: {
  /** The doctor's Start: begins the consultation and opens its note (as on Today). */
  start?: (formData: FormData) => Promise<void>;
  appointmentId: string;
  status: AppointmentStatus;
  moves: AppointmentStatus[];
  children?: ReactNode;
}) {
  const steps = moves.filter((m) => m !== "CANCELLED");
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {steps.map((next, i) => (
        <form key={next} action={next === "IN_CONSULTATION" && start ? start : setAppointmentStatus}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="status" value={next} />
          <button className={buttonClass(i === 0 ? "primary" : "secondary")}>{statusActionLabel(status, next)}</button>
        </form>
      ))}
      {children}
      {moves.includes("CANCELLED") ? (
        <div className="ml-auto">
          <ActionDialog label="Cancel visit" title="Cancel this visit?" action={setAppointmentStatus} submitLabel="Cancel visit">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="status" value="CANCELLED" />
            <p className="text-sm text-ink-muted">The time is freed for someone else. You can restore it while its time is still to come.</p>
          </ActionDialog>
        </div>
      ) : null}
    </div>
  );
}
