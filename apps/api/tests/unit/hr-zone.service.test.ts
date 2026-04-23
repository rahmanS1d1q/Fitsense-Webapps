/**
 * Unit tests untuk HRZoneClassifier
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { classifyZone } from "../../src/services/hr-zone.service";

describe("HRZoneClassifier — classifyZone", () => {
  // Invalid age cases → unknown
  describe("usia tidak valid → unknown", () => {
    it("age = 0 → unknown", () => {
      expect(classifyZone(100, 0)).toBe("unknown");
    });

    it("age = null → unknown", () => {
      expect(classifyZone(100, null)).toBe("unknown");
    });

    it("age = undefined → unknown", () => {
      expect(classifyZone(100, undefined)).toBe("unknown");
    });
  });

  // Boundary tests for age=30, Max_HR=190
  // pct = hr / 190
  describe("boundary tests (age=30, Max_HR=190)", () => {
    it("hr=94 (49.5%) → rest", () => {
      expect(classifyZone(94, 30)).toBe("rest");
    });

    it("hr=95 (50%) → fat_burn", () => {
      expect(classifyZone(95, 30)).toBe("fat_burn");
    });

    it("hr=113 (59.5%) → fat_burn", () => {
      expect(classifyZone(113, 30)).toBe("fat_burn");
    });

    it("hr=114 (60%) → cardio", () => {
      expect(classifyZone(114, 30)).toBe("cardio");
    });

    it("hr=132 (69.5%) → cardio", () => {
      expect(classifyZone(132, 30)).toBe("cardio");
    });

    it("hr=133 (70%) → aerobic", () => {
      expect(classifyZone(133, 30)).toBe("aerobic");
    });

    it("hr=151 (79.5%) → aerobic", () => {
      expect(classifyZone(151, 30)).toBe("aerobic");
    });

    it("hr=152 (80%) → peak", () => {
      expect(classifyZone(152, 30)).toBe("peak");
    });

    it("hr=300 → peak", () => {
      expect(classifyZone(300, 30)).toBe("peak");
    });
  });
});
