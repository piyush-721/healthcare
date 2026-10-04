import { describe, expect, it } from "vitest";

import type { VitalRecord } from "@/types/api";

import { VITAL_FIELDS, formatVital, vitalTransform } from "./config";
import { latestVitals } from "./HealthInfoTabs";
import { bodyFromValues, validateRequired } from "./RecordForm";

const vital = (overrides: Partial<VitalRecord>): VitalRecord =>
  ({
    id: "v",
    profile: "p",
    vital_type: "HEART_RATE",
    value: "70.00",
    secondary_value: null,
    unit: "bpm",
    measured_at: "2026-01-01T08:00:00Z",
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as VitalRecord;

describe("vital forms", () => {
  it("requires the diastolic value only for blood pressure", () => {
    const bp = {
      vital_type: "BLOOD_PRESSURE",
      value: "120",
      secondary_value: "",
      unit: "mmHg",
      measured_at: "2026-01-01T08:00",
      notes: "",
    };
    expect(validateRequired(VITAL_FIELDS, bp)).toHaveProperty("secondary_value");
    const hr = { ...bp, vital_type: "HEART_RATE", secondary_value: "80" };
    expect(validateRequired(VITAL_FIELDS, hr)).toEqual({});
    expect(bodyFromValues(VITAL_FIELDS, hr).secondary_value).toBeNull();
  });

  it("pre-fills the unit when the type changes", () => {
    expect(vitalTransform({ vital_type: "WEIGHT", unit: "mmHg" }, "vital_type").unit).toBe("kg");
  });

  it("shows the latest reading per type without interpretation", () => {
    const latest = latestVitals([
      vital({ id: "a", measured_at: "2026-01-01T08:00:00Z", value: "70.00" }),
      vital({ id: "b", measured_at: "2026-02-01T08:00:00Z", value: "64.00" }),
      vital({
        id: "c",
        vital_type: "BLOOD_PRESSURE",
        value: "120.00",
        secondary_value: "80.00",
        unit: "mmHg",
      }),
    ]);
    expect(latest.map((v) => v.id)).toEqual(["c", "b"]);
    expect(formatVital(latest[0])).toBe("120/80 mmHg");
  });
});
