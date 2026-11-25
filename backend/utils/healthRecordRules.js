export const HEALTH_MEASUREMENT_RANGES = Object.freeze({
  systolic: Object.freeze([50, 250]),
  diastolic: Object.freeze([30, 150]),
  bloodSugar: Object.freeze([20, 800]),
  heartRate: Object.freeze([20, 250]),
  weight: Object.freeze([1, 500]),
  oxygenLevel: Object.freeze([50, 100]),
});

export const HEALTH_MEASUREMENTS = Object.freeze(
  Object.keys(HEALTH_MEASUREMENT_RANGES),
);
