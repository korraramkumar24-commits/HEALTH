import Appointment from '../models/Appointment.js';
import Medication from '../models/Medication.js';
import MedicationLog from '../models/MedicationLog.js';
import Notification from '../models/Notification.js';

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const scheduledDateTime = (day, time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const createReminderOnce = async (reminder) => {
  try {
    await Notification.updateOne(
      { reminderKey: reminder.reminderKey },
      { $setOnInsert: reminder },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
};

export const createDueReminders = async (now = new Date()) => {
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [appointments, medications] = await Promise.all([
    Appointment.find({
      status: 'scheduled',
      startsAt: { $gt: now, $lte: nextDay },
    })
      .populate({ path: 'patientId', select: 'userId' })
      .select('_id patientId startsAt')
      .lean(),
    Medication.find({
      isActive: true,
      startsAt: { $lte: now },
      $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
    })
      .populate({ path: 'patientId', select: 'userId' })
      .select('_id patientId name scheduledTimes')
      .lean(),
  ]);

  for (const appointment of appointments) {
    if (!appointment.patientId?.userId) continue;
    await createReminderOnce({
      recipientId: appointment.patientId.userId,
      appointmentId: appointment._id,
      kind: 'appointment-reminder',
      message: `Reminder: you have an appointment on ${new Date(appointment.startsAt).toLocaleString()}.`,
      reminderKey: `appointment:${appointment._id}`,
    });
  }

  const dayStart = startOfDay(now);
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDoses = [];
  for (const medication of medications) {
    if (!medication.patientId?.userId) continue;
    for (const time of medication.scheduledTimes) {
      const scheduledFor = scheduledDateTime(dayStart, time);
      if (scheduledFor <= now) {
        dueDoses.push({ medication, scheduledFor, time });
      }
    }
  }

  if (!dueDoses.length) return { appointmentReminders: appointments.length, medicationReminders: 0 };

  const logs = await MedicationLog.find({
    medicationId: { $in: [...new Set(dueDoses.map(({ medication }) => String(medication._id)))] },
    scheduledFor: { $gte: dayStart, $lt: tomorrow },
  })
    .select('medicationId scheduledFor')
    .lean();
  const logged = new Set(logs.map((log) => `${log.medicationId}:${log.scheduledFor.getTime()}`));
  let medicationReminders = 0;
  for (const { medication, scheduledFor, time } of dueDoses) {
    if (logged.has(`${medication._id}:${scheduledFor.getTime()}`)) continue;
    await createReminderOnce({
      recipientId: medication.patientId.userId,
      medicationId: medication._id,
      kind: 'medication-reminder',
      message: `Reminder: log today's ${time} dose for ${medication.name}.`,
      reminderKey: `medication:${medication._id}:${scheduledFor.toISOString()}`,
    });
    medicationReminders += 1;
  }

  return { appointmentReminders: appointments.length, medicationReminders };
};

export const startReminderService = ({ intervalMs = 15 * 60 * 1000 } = {}) => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await createDueReminders();
    } catch {
      console.error('Reminder service could not create one or more in-app reminders.');
    } finally {
      running = false;
    }
  };

  void run();
  return setInterval(run, intervalMs);
};

export default startReminderService;
