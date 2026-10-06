import { describe, expect, it } from "vitest";
import { likeSafe, looksLikeCode, queryWords, rankHits } from "@/lib/diagnosis-rank";

const hit = (code: string, title: string, leaf = true) => ({ code, title, leaf });

describe("looksLikeCode", () => {
  it("tells a code from words", () => {
    for (const q of ["CA23", "ca23.3", "1A00", "BA00.Z", "CA", "MD12"]) expect(looksLikeCode(q)).toBe(true);
    for (const q of ["asthma", "high blood", "CA23.322", "cough cold"]) expect(looksLikeCode(q)).toBe(false);
  });
});

describe("queryWords / likeSafe", () => {
  it("splits words and keeps dotted codes whole", () => {
    expect(queryWords("Asthma, unspecified")).toEqual(["asthma", "unspecified"]);
    expect(queryWords("CA23.3 asthma")).toEqual(["ca23.3", "asthma"]);
  });

  it("escapes LIKE wildcards", () => {
    expect(likeSafe("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("rankHits", () => {
  const hits = [
    hit("CA23.32", "Unspecified asthma, uncomplicated"),
    hit("CA23", "Asthma", false),
    hit("CA23.3", "Unspecified asthma", false),
    hit("1B12", "Asthmatic something"),
    hit("CA23", "Asthma", false), // a duplicate from the second query
  ];

  it("puts the exact code first, then codes starting with it", () => {
    expect(rankHits(hits, "ca23").map((h) => h.code)).toEqual(["CA23", "CA23.32", "CA23.3", "1B12"]);
  });

  it("puts the exact title first, then titles starting with the words, leaves before branches", () => {
    expect(rankHits(hits, "asthma").map((h) => h.code)).toEqual(["CA23", "1B12", "CA23.32", "CA23.3"]);
  });
});
