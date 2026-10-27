/**
 * TrustSense-BMS Cybersecurity & Data Trust Validation Engine
 * 
 * Implements pre-inference multi-stage validation:
 * 1. Schema & Required Fields Integrity
 * 2. Type & Numeric Validity (no NaN, Infinity, nulls)
 * 3. Freshness & Monotonicity (replay detection, duplicate timestamps)
 * 4. Battery Physics Plausibility:
 *    - Voltage bounds [2.45V, 4.35V] for Panasonic NCR18650PF
 *    - Current bounds [-16.0A, 12.0A]
 *    - Ambient temperature bounds [-35.0°C, 70.0°C]
 *    - Power consistency: |P - (V * I)| <= 0.20 W
 *    - Rate-of-change physics limits (|dV/dt| <= 1.2 V/s, |dI/dt| <= 35.0 A/s)
 *      Rate violations are BLOCK (quarantined, excluded from the 60-step buffer).
 * 
 * Decision outputs:
 * - SAFE: Passed all checks. Admitted to 60-step inference sequence buffer.
 * - SUSPICIOUS: Borderline condition or mild OOD. Admitted with warning flag.
 * - BLOCK: Physically impossible, corrupted, duplicate, or deliberate attack.
 *          QUARANTINED and STRICTLY BLOCKED from AI inference!
 */

export interface TelemetrySample {
  voltage_v: number;
  current_a: number;
  ah: number;
  chamber_temp_degC: number;
  power_w: number;
  current_abs_a: number;
  time_s?: number;
  sampleTime?: number;
  recordIndex?: number;
}

export interface TrustDecision {
  decision: "SAFE" | "SUSPICIOUS" | "BLOCK";
  confidence: number;
  reasons: string[];
  passedChecks: string[];
  violations: string[];
  metrics: {
    voltage: number;
    current: number;
    calculatedPower: number;
    powerDiscrepancy: number;
    rateOfVoltageChange?: number;
    rateOfCurrentChange?: number;
  };
  timestamp: string;
}

export class TrustValidator {
  private lastSample: TelemetrySample | null = null;
  private seenTimestamps = new Set<number>();
  private readonly maxSeenHistory = 2000;

  // Configurable Panasonic 18650PF physical envelopes
  private readonly config = {
    voltageMin: 2.45,       // Cutoff is 2.50V (allowing 50mV measurement noise margin)
    voltageMax: 4.35,       // Maximum charge is 4.20V + 0.15V overshoot tolerance
    currentMin: -16.0,      // Max continuous discharge ~10A-15A
    currentMax: 12.0,       // Max charge current ~4A-10A
    chamberTempMin: -35.0,  // Subzero chamber testing range
    chamberTempMax: 70.0,   // High temperature chamber limit
    powerToleranceW: 0.20,  // Permitted P vs (V*I) rounding tolerance
    maxDVoltsPerSec: 1.2,   // Maximum physically possible dV/dt for 18650 cell
    maxDAmpsPerSec: 35.0,   // Maximum physically possible dI/dt
  };

  /**
   * Reset internal history (called on simulation restart)
   */
  public reset(): void {
    this.lastSample = null;
    this.seenTimestamps.clear();
  }

  /**
   * Validates an incoming telemetry record.
   */
  public validate(sample: TelemetrySample): TrustDecision {
    const reasons: string[] = [];
    const passedChecks: string[] = [];
    const violations: string[] = [];
    let isBlocked = false;
    let isSuspicious = false;

    // 1. Schema & Required Fields Check
    const requiredFields = [
      "voltage_v",
      "current_a",
      "ah",
      "chamber_temp_degC",
      "power_w",
      "current_abs_a"
    ];

    for (const f of requiredFields) {
      const val = (sample as any)[f];
      if (val === undefined || val === null) {
        violations.push(`MISSING_FIELD: '${f}' is required`);
        isBlocked = true;
      } else if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
        violations.push(`INVALID_NUMERIC: '${f}' has invalid value ${val}`);
        isBlocked = true;
      }
    }

    if (!isBlocked) {
      passedChecks.push("SCHEMA_AND_TYPES_VALID");
    }

    // 2. Freshness & Duplicate / Replay Check
    const timeVal = sample.time_s ?? sample.sampleTime;
    if (timeVal !== undefined && typeof timeVal === "number") {
      if (this.seenTimestamps.has(timeVal)) {
        violations.push(`REPLAY_DUPLICATE_TIMESTAMP: Sample timestamp ${timeVal}s already processed`);
        isBlocked = true;
      } else {
        this.seenTimestamps.add(timeVal);
        if (this.seenTimestamps.size > this.maxSeenHistory) {
          const firstVal = this.seenTimestamps.values().next().value;
          if (firstVal !== undefined) this.seenTimestamps.delete(firstVal);
        }
        passedChecks.push("FRESHNESS_VERIFIED");
      }
    }

    // 3. Physics Plausibility Checks
    const v = sample.voltage_v;
    const i = sample.current_a;
    const p = sample.power_w;
    const absI = sample.current_abs_a;
    const tAmb = sample.chamber_temp_degC;

    // Voltage Envelope
    if (v < this.config.voltageMin || v > this.config.voltageMax) {
      violations.push(`VOLTAGE_OUT_OF_BOUNDS: ${v.toFixed(3)}V (Safe: ${this.config.voltageMin}V - ${this.config.voltageMax}V)`);
      isBlocked = true;
    } else {
      passedChecks.push("VOLTAGE_BOUNDS_OK");
    }

    // Current Envelope
    if (i < this.config.currentMin || i > this.config.currentMax) {
      violations.push(`CURRENT_OUT_OF_BOUNDS: ${i.toFixed(2)}A (Safe: ${this.config.currentMin}A - ${this.config.currentMax}A)`);
      isBlocked = true;
    } else {
      passedChecks.push("CURRENT_BOUNDS_OK");
    }

    // Absolute Current Consistency
    if (Math.abs(absI - Math.abs(i)) > 0.05) {
      violations.push(`CURRENT_ABS_DISCREPANCY: |${i}| != ${absI}`);
      isSuspicious = true;
    } else {
      passedChecks.push("CURRENT_ABS_CONSISTENT");
    }

    // Ambient Temperature Envelope
    if (tAmb < this.config.chamberTempMin || tAmb > this.config.chamberTempMax) {
      violations.push(`CHAMBER_TEMP_OUT_OF_BOUNDS: ${tAmb.toFixed(1)}°C (Safe: ${this.config.chamberTempMin}°C - ${this.config.chamberTempMax}°C)`);
      isSuspicious = true;
    } else {
      passedChecks.push("CHAMBER_TEMP_BOUNDS_OK");
    }

    // Power Cross-Consistency Check (P = V * I)
    const expectedPower = v * i;
    const powerDiff = Math.abs(p - expectedPower);
    if (powerDiff > this.config.powerToleranceW) {
      violations.push(`POWER_CROSS_CHECK_FAILED: Reported ${p.toFixed(2)}W vs Calculated V*I ${expectedPower.toFixed(2)}W (Δ ${powerDiff.toFixed(2)}W)`);
      isBlocked = true;
    } else {
      passedChecks.push("POWER_CONSERVATION_OK");
    }

    // Rate-of-Change Checks (dV/dt, dI/dt)
    let dVRate: number | undefined;
    let dIRate: number | undefined;

    if (this.lastSample && this.lastSample.time_s !== undefined && sample.time_s !== undefined) {
      const dt = sample.time_s - this.lastSample.time_s;
      if (dt > 0 && dt <= 5.0) {
        dVRate = Math.abs(v - this.lastSample.voltage_v) / dt;
        dIRate = Math.abs(i - this.lastSample.current_a) / dt;

        if (dVRate > this.config.maxDVoltsPerSec) {
          violations.push(`RAPID_VOLTAGE_SPIKE: dV/dt = ${dVRate.toFixed(2)} V/s exceeds limit ${this.config.maxDVoltsPerSec} V/s`);
          isBlocked = true;
        } else {
          passedChecks.push("DV_DT_STABLE");
        }

        if (dIRate > this.config.maxDAmpsPerSec) {
          violations.push(`CURRENT_SURGE_DETECTED: dI/dt = ${dIRate.toFixed(2)} A/s exceeds limit ${this.config.maxDAmpsPerSec} A/s`);
          isBlocked = true;
        } else {
          passedChecks.push("DI_DT_STABLE");
        }
      }
    }

    // 4. Decision Formulation
    let decision: "SAFE" | "SUSPICIOUS" | "BLOCK" = "SAFE";
    let confidence = 0.99;

    if (isBlocked) {
      decision = "BLOCK";
      confidence = 0.0;
      reasons.push(...violations);
    } else if (isSuspicious) {
      decision = "SUSPICIOUS";
      confidence = 0.65;
      reasons.push(...violations);
    } else {
      decision = "SAFE";
      confidence = 0.98;
      reasons.push("All physical bounds, schema integrity, and freshness checks passed successfully.");
    }

    // Keep rate-of-change history on admitted samples only. Updating on BLOCK
    // would make the next valid sample look like a spike against the rejected one.
    if (!isBlocked && typeof v === "number" && typeof i === "number") {
      this.lastSample = { ...sample };
    }

    return {
      decision,
      confidence,
      reasons,
      passedChecks,
      violations,
      metrics: {
        voltage: v,
        current: i,
        calculatedPower: expectedPower,
        powerDiscrepancy: powerDiff,
        rateOfVoltageChange: dVRate,
        rateOfCurrentChange: dIRate,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
