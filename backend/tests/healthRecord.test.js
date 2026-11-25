import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import HealthRecord from '../models/HealthRecord.js';
import { getTrendLabel } from '../utils/trendRules.js';

const makeRecord = (fields = {}) => new HealthRecord({
  patientId: new mongoose.Types.ObjectId(),
  ...fields,
});

test('accepts all measurements at documented range boundaries', async () => {
  const record = makeRecord({
    systolic: 250,
    diastolic: 150,
    bloodSugar: 800,
    heartRate: 20,
    weight: 1,
    oxygenLevel: 50,
  });
  await assert.doesNotReject(record.validate());
});

test('allows measurement fields to be omitted individually', async () => {
  const record = makeRecord({ heartRate: 70 });
  await assert.doesNotReject(record.validate());
});

test('requires at least one measurement', async () => {
  const record = makeRecord();
  await assert.rejects(record.validate(), (error) => (
    error.name === 'ValidationError' && Boolean(error.errors.measurements)
  ));
});

test('rejects out-of-range values', async () => {
  const record = makeRecord({ systolic: 49 });
  await assert.rejects(record.validate(), (error) => (
    error.name === 'ValidationError' && error.errors.systolic?.message.includes('at least 50')
  ));
});

test('rejects systolic not greater than diastolic', async () => {
  const record = makeRecord({ systolic: 80, diastolic: 90 });
  await assert.rejects(record.validate(), (error) => (
    error.name === 'ValidationError' && Boolean(error.errors.systolic)
  ));
});

test('rejects a recordedAt date in the future', async () => {
  const record = makeRecord({
    heartRate: 70,
    recordedAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(record.validate(), (error) => (
    error.name === 'ValidationError' && Boolean(error.errors.recordedAt)
  ));
});

test('labels trends with the documented five-percent movement heuristic', () => {
  assert.equal(getTrendLabel('systolic', 120, 118), 'stable');
  assert.equal(getTrendLabel('systolic', 120, 110), 'improving');
  assert.equal(getTrendLabel('oxygenLevel', 90, 96), 'improving');
  assert.equal(getTrendLabel('bloodSugar', 100, 115), 'needs review');
  assert.equal(getTrendLabel('heartRate', undefined, 80), 'needs review');
});
