import { describe, expect, it } from "vitest";
import { EXAM_SYSTEMS, isNormalFinding, parseExam, serializeExam } from "@/lib/exam";

describe("exam by system", () => {
  it("writes one line per examined system, in order, and reads it back", () => {
    const findings = { abdomen: "Tender RLQ.", general: "Alert." };
    const text = serializeExam(findings);
    expect(text).toBe("General survey: Alert.\nAbdomen: Tender RLQ.");
    expect(parseExam(text)).toEqual(findings);
  });

  it("leaves systems not examined out", () => {
    expect(serializeExam({ general: "  ", heent: "Normal." })).toBe("HEENT: Normal.");
  });

  it("keeps an older free-text exam as free text", () => {
    expect(parseExam("Lungs clear. Heart regular.")).toBeNull();
    expect(parseExam("")).toEqual({});
  });

  it("knows an untouched normal finding", () => {
    const cardio = EXAM_SYSTEMS.find((s) => s.key === "cardio")!;
    expect(isNormalFinding("cardio", cardio.normal)).toBe(true);
    expect(isNormalFinding("cardio", "Grade 2/6 systolic murmur.")).toBe(false);
  });
});
