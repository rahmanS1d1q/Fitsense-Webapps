/**
 * HRZoneClassifier — Klasifikasi zona HR berdasarkan usia member.
 *
 * Requirements: 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

export type HRZone = "rest" | "fat_burn" | "cardio" | "aerobic" | "peak" | "unknown";

/**
 * Classifies a heart rate value into an HR zone based on the member's age.
 *
 * Max_HR = 220 - age
 * Thresholds:
 *   rest:     HR < 50% of Max_HR
 *   fat_burn: 50% <= HR < 60% of Max_HR
 *   cardio:   60% <= HR < 70% of Max_HR
 *   aerobic:  70% <= HR < 80% of Max_HR
 *   peak:     HR >= 80% of Max_HR
 *   unknown:  age is null, undefined, or 0
 *
 * Requirements: 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export function classifyZone(hr: number, age: number | null | undefined): HRZone {
  if (!age) {
    console.warn(
      `[HRZoneClassifier] Usia tidak tersedia atau bernilai nol (age=${age}). Mengembalikan zona 'unknown'.`,
    );
    return "unknown";
  }

  const maxHr = 220 - age;
  const pct = hr / maxHr;

  if (pct < 0.5) return "rest";
  if (pct < 0.6) return "fat_burn";
  if (pct < 0.7) return "cardio";
  if (pct < 0.8) return "aerobic";
  return "peak";
}
