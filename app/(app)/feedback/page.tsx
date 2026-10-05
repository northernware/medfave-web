import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { FeedbackView } from "@/components/feedback-view";

export const metadata: Metadata = { title: "Patient feedback" };

/** The doctor's own feedback. */
export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const doctor = await requireDoctor();
  return <FeedbackView scope={{ doctorId: doctor.id }} base="/feedback" linkBase="" searchParams={await searchParams} />;
}
