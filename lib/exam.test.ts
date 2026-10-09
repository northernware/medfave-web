import { describe, expect, it } from "vitest";
import { EXAM_SYSTEMS, gridToText, isNormalFinding, normalGrid, normalParts, parseExam, partsToText, serializeExam, textToGrid, textToParts } from "@/lib/exam";

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

  it("writes pulses and reflexes as a right/left grid and reads them back", () => {
    const values = { ...normalGrid("pulses"), "Dorsalis pedis": ["1+", "2+"] as [string, string] };
    const text = gridToText("pulses", values, "Trace ankle edema");
    expect(text).toContain("Dorsalis pedis 1+/2+");
    expect(textToGrid("pulses", text)).toEqual({ values, note: "Trace ankle edema" });
    expect(isNormalFinding("reflexes", gridToText("reflexes", normalGrid("reflexes")))).toBe(true);
    expect(EXAM_SYSTEMS.find((s) => s.key === "reflexes")!.normal).toContain("Plantar ↓/↓");
  });

  it("treats a pulses line typed as prose as prose", () => {
    expect(textToGrid("pulses", "Weak pulses in both feet")).toBeNull();
  });

  it("writes HEENT in parts and reads them back, through the whole exam", () => {
    const parts = { ...normalParts("heent"), Ears: "Cerumen obscures right TM." };
    const line = partsToText("heent", parts);
    expect(line).toContain("Ears: Cerumen obscures right TM. Nose:");
    expect(textToParts("heent", line)).toEqual(parts);
    const exam = parseExam(serializeExam({ heent: line }))!;
    expect(textToParts("heent", exam.heent)).toEqual(parts);
    expect(isNormalFinding("heent", partsToText("heent", normalParts("heent")))).toBe(true);
  });

  it("keeps an older HEENT written as prose as prose", () => {
    expect(textToParts("heent", "Normocephalic. PERRL.")).toBeNull();
  });
});
