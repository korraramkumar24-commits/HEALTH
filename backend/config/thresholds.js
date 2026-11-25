// DEMO THRESHOLDS ONLY - not clinically validated.
const DEMO_THRESHOLDS = Object.freeze({
  systolic: {
    low: { min: null, max: 89 },
    medium: { min: 140, max: 159 },
    high: { min: 160, max: 179 },
    critical: { min: 180, max: null },
  },
  diastolic: {
    low: { min: null, max: 49 },
    medium: { min: 90, max: 99 },
    high: { min: 100, max: 119 },
    critical: { min: 120, max: null },
  },
  bloodSugar: {
    low: { min: null, max: 69 },
    medium: { min: 181, max: 249 },
    high: { min: 250, max: 399 },
    critical: { min: 400, max: null },
  },
  heartRate: {
    low: { min: null, max: 49 },
    medium: { min: 101, max: 119 },
    high: { min: 120, max: 149 },
    critical: { min: 150, max: null },
  },
  weight: {
    low: { min: null, max: 39 },
    medium: { min: 120, max: 149 },
    high: { min: 150, max: 199 },
    critical: { min: 200, max: null },
  },
  oxygenLevel: {
    low: { min: 90, max: 94 },
    medium: { min: 85, max: 89 },
    high: { min: 80, max: 84 },
    critical: { min: null, max: 79 },
  },
});

export default DEMO_THRESHOLDS;
