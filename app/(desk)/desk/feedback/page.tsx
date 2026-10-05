import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { FeedbackView } from "@/components/feedback-view";

export const metadata: Metadata = { title: "Patient feedback" };

/** The clinic's feedback, for the front desk and administrators. Doctors read their own at /feedback. */
export default async function DeskFeedbackPage({ searchParams }: PageProps<"/desk/feedback">) {
  const staff = await requireStaff();
  return <FeedbackView scope={{ clinicId: staff.clinicId }} base="/desk/feedback" linkBase="/desk" searchParams={await searchParams} />;
}
