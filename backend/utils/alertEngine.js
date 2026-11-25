const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const MEASUREMENT_LABELS = {
  bloodSugar: 'Blood sugar',
  oxygenLevel: 'Oxygen level',
};

const isInBand = (value, band) =>
  (band.min === null || value >= band.min) &&
  (band.max === null || value <= band.max);

export const evaluateRecord = (record, thresholds) => {
  if (!record || !thresholds || typeof thresholds !== 'object') return [];

  const alerts = [];
  for (const [type, bands] of Object.entries(thresholds)) {
    const value = record[type];
    if (typeof value !== 'number' || !Number.isFinite(value) || !bands) continue;

    const severity = SEVERITIES.find((level) => bands[level] && isInBand(value, bands[level]));
    if (severity) {
      const label = MEASUREMENT_LABELS[type] || type;
      alerts.push({
        type,
        severity,
        message: `${label} reading outside demo range - needs clinical review.`,
      });
    }
  }

  return alerts;
};

export default evaluateRecord;
