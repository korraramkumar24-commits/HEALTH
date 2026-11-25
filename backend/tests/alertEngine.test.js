import test from 'node:test';
import assert from 'node:assert/strict';
import DEMO_THRESHOLDS from '../config/thresholds.js';
import { evaluateRecord } from '../utils/alertEngine.js';

test('values inside demo ranges do not produce alerts', () => {
  assert.deepEqual(
    evaluateRecord(
      { systolic: 139, diastolic: 89, bloodSugar: 180, heartRate: 100, oxygenLevel: 95 },
      DEMO_THRESHOLDS,
    ),
    [],
  );
});

test('every severity boundary is inclusive and produces neutral messages', () => {
  const cases = [
    ['systolic', 89, 'low'],
    ['systolic', 140, 'medium'],
    ['systolic', 160, 'high'],
    ['systolic', 180, 'critical'],
    ['bloodSugar', 69, 'low'],
    ['bloodSugar', 181, 'medium'],
    ['bloodSugar', 250, 'high'],
    ['bloodSugar', 400, 'critical'],
    ['oxygenLevel', 94, 'low'],
    ['oxygenLevel', 89, 'medium'],
    ['oxygenLevel', 84, 'high'],
    ['oxygenLevel', 79, 'critical'],
  ];

  for (const [type, value, severity] of cases) {
    const [alert] = evaluateRecord({ [type]: value }, DEMO_THRESHOLDS);
    assert.equal(alert?.type, type);
    assert.equal(alert?.severity, severity);
    assert.match(alert?.message, /outside demo range - needs clinical review/i);
    assert.doesNotMatch(alert?.message, /diagnos|disease|condition|hypertension|diabetes/i);
  }
});

test('uses readable measurement names in neutral messages', () => {
  const [bloodSugar] = evaluateRecord({ bloodSugar: 400 }, DEMO_THRESHOLDS);
  const [oxygen] = evaluateRecord({ oxygenLevel: 79 }, DEMO_THRESHOLDS);
  assert.equal(bloodSugar.message, 'Blood sugar reading outside demo range - needs clinical review.');
  assert.equal(oxygen.message, 'Oxygen level reading outside demo range - needs clinical review.');
});

test('all configured band endpoints map to their declared severity', () => {
  for (const [type, bands] of Object.entries(DEMO_THRESHOLDS)) {
    for (const [severity, { min, max }] of Object.entries(bands)) {
      const endpoints = [...new Set([min, max].filter(Number.isFinite))];
      for (const value of endpoints) {
        const alert = evaluateRecord({ [type]: value }, DEMO_THRESHOLDS)
          .find((item) => item.type === type);
        assert.equal(alert?.severity, severity, `${type} value ${value} should be ${severity}`);
      }
    }
  }
});

test('ignores missing, non-numeric, and unconfigured values', () => {
  assert.deepEqual(
    evaluateRecord({ systolic: '180', customValue: 500 }, DEMO_THRESHOLDS),
    [],
  );
  assert.deepEqual(evaluateRecord(null, DEMO_THRESHOLDS), []);
  assert.deepEqual(evaluateRecord({ systolic: 180 }, null), []);
});

test('evaluates each measurement independently', () => {
  const alerts = evaluateRecord(
    { systolic: 180, bloodSugar: 400 },
    DEMO_THRESHOLDS,
  );
  assert.deepEqual(
    alerts.map(({ type, severity }) => ({ type, severity })),
    [
      { type: 'systolic', severity: 'critical' },
      { type: 'bloodSugar', severity: 'critical' },
    ],
  );
});
