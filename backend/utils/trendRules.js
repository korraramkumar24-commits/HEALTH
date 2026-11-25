const TREND_DIRECTIONS = Object.freeze({
  systolic: 'lower',
  diastolic: 'lower',
  bloodSugar: 'lower',
  heartRate: 'lower',
  weight: 'lower',
  oxygenLevel: 'higher',
});

// Project-only movement labels use (latest - earliest) / max(abs(earliest),
// abs(latest), 1). A change of 5% or less is stable; larger changes are
// improving only in the configured numeric direction. These are not clinical
// targets, risk assessments, or medical advice.
export const TREND_RULES = Object.freeze({
  stableChangePercent: 5,
  directions: TREND_DIRECTIONS,
});

export const getTrendLabel = (measurement, firstValue, lastValue) => {
  if (!Number.isFinite(firstValue) || !Number.isFinite(lastValue)) {
    return 'needs review';
  }

  const baseline = Math.max(Math.abs(firstValue), Math.abs(lastValue), 1);
  const changePercent = ((lastValue - firstValue) / baseline) * 100;

  if (Math.abs(changePercent) <= TREND_RULES.stableChangePercent) {
    return 'stable';
  }

  const direction = TREND_DIRECTIONS[measurement];
  const movingInConfiguredDirection =
    (direction === 'lower' && changePercent < 0) ||
    (direction === 'higher' && changePercent > 0);

  return movingInConfiguredDirection ? 'improving' : 'needs review';
};

export default getTrendLabel;
