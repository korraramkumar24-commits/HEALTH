const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const scheduledDateTime = (date, time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduledAt = new Date(date);
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt;
};

export const summarizeMedicationAdherence = (medications, logs, now = new Date()) => {
  const periodStart = startOfDay(now);
  periodStart.setDate(periodStart.getDate() - 29);
  const periodEnd = startOfDay(now);
  periodEnd.setDate(periodEnd.getDate() + 1);
  const taken = new Set(
    logs
      .filter((log) => log.status === 'taken')
      .map((log) => `${log.medicationId}:${new Date(log.scheduledFor).getTime()}`),
  );

  let scheduledDoses = 0;
  let takenDoses = 0;
  for (const medication of medications) {
    const startsAt = startOfDay(medication.startsAt);
    const endsAt = medication.endsAt ? startOfDay(medication.endsAt) : periodEnd;
    const firstDay = new Date(Math.max(periodStart.getTime(), startsAt.getTime()));
    const lastDay = new Date(Math.min(periodEnd.getTime(), endsAt.getTime()));

    for (
      const day = new Date(firstDay);
      day < lastDay;
      day.setDate(day.getDate() + 1)
    ) {
      for (const time of medication.scheduledTimes) {
        const scheduledFor = scheduledDateTime(day, time);
        if (
          scheduledFor >= new Date(medication.startsAt) &&
          scheduledFor < periodEnd &&
          scheduledFor <= now
        ) {
          scheduledDoses += 1;
          if (taken.has(`${medication._id}:${scheduledFor.getTime()}`)) takenDoses += 1;
        }
      }
    }
  }

  return {
    percentage: scheduledDoses ? Math.round((takenDoses / scheduledDoses) * 100) : null,
    takenDoses,
    scheduledDoses,
    days: 30,
  };
};

export default summarizeMedicationAdherence;
