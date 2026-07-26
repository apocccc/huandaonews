import { describe, expect, it } from "vitest";
import { computeReleaseTime } from "@/lib/daily-rewrite";

const JST = 9 * 60 * 60 * 1000;

function jstHM(d: Date): string {
  const j = new Date(d.getTime() + JST);
  return `${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")}`;
}

describe("computeReleaseTime", () => {
  // ジョブ実行想定時刻: 8:00 JST = 23:00 UTC 前日
  const jobTime = new Date("2026-07-23T23:00:00Z"); // = 7/24 08:00 JST

  it("returns a time within the same morning 8:30-9:30 JST window", () => {
    const atStart = computeReleaseTime(jobTime, 0);
    const atEnd = computeReleaseTime(jobTime, 0.999999);
    expect(jstHM(atStart)).toBe("08:30");
    expect(atEnd.getTime()).toBeLessThan(
      new Date("2026-07-24T00:30:00Z").getTime() // 09:30 JST
    );
    expect(atEnd.getTime()).toBeGreaterThan(atStart.getTime());
  });

  it("uses the next day's window when already past 8:30 JST", () => {
    const lateMorning = new Date("2026-07-24T02:00:00Z"); // 11:00 JST
    const release = computeReleaseTime(lateMorning, 0);
    expect(release.getTime()).toBeGreaterThan(lateMorning.getTime());
    expect(jstHM(release)).toBe("08:30");
    // 翌日 7/25 の窓
    expect(release.toISOString()).toBe("2026-07-24T23:30:00.000Z");
  });

  it("release time is always in the future relative to now", () => {
    for (const iso of [
      "2026-07-23T22:59:00Z",
      "2026-07-23T23:31:00Z",
      "2026-07-24T10:00:00Z",
    ]) {
      const now = new Date(iso);
      expect(computeReleaseTime(now, 0.5).getTime()).toBeGreaterThan(
        now.getTime()
      );
    }
  });
});
