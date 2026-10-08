import { describe, expect, it } from "vitest";
import { movesFrom } from "@/lib/domain";

describe("movesFrom", () => {
  it("offers a late check-in or a restore for a no-show on its day, while it's still due", () => {
    expect(movesFrom("NO_SHOW", true, true)).toEqual(["CHECKED_IN", "CONFIRMED"]);
  });

  it("offers only the late check-in once the visit's time has passed", () => {
    expect(movesFrom("NO_SHOW", true, false)).toEqual(["CHECKED_IN"]);
  });

  it("offers nothing for a no-show on a later day", () => {
    expect(movesFrom("NO_SHOW", false, false)).toEqual([]);
  });

  it("restores a cancelled visit only while it's still to come", () => {
    expect(movesFrom("CANCELLED", false, true)).toEqual(["CONFIRMED"]);
    expect(movesFrom("CANCELLED", false, false)).toEqual([]);
  });

  it("lets a checked-in visit be undone, started, cancelled or missed", () => {
    expect(movesFrom("CHECKED_IN", true, true)).toEqual(["IN_CONSULTATION", "CONFIRMED", "CANCELLED", "NO_SHOW"]);
  });

  it("offers no check-in or start away from the visit's day, and no no-show before its time", () => {
    expect(movesFrom("CONFIRMED", false, true, false)).not.toContain("CHECKED_IN");
    expect(movesFrom("CONFIRMED", false, true, false)).not.toContain("NO_SHOW");
    expect(movesFrom("CONFIRMED", true, true, true)).toContain("NO_SHOW");
    expect(movesFrom("CONFIRMED", true, true, false)).toContain("CHECKED_IN");
  });
});
