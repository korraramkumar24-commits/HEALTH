import User from '../models/User.js';
import Disease from '../models/Disease.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';

const seedDemoData = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Demo data seeding skipped in production.');
    return;
  }
  if (!process.env.DEMO_PASSWORD) {
    throw new Error('DEMO_PASSWORD is required when demo data seeding is enabled.');
  }
  if (process.env.DEMO_PASSWORD.length < 12) {
    throw new Error('DEMO_PASSWORD must contain at least 12 characters.');
  }

  const diseaseNames = ['Diabetes', 'Hypertension', 'Heart Disease', 'Asthma'];

  for (const name of diseaseNames) {
    await Disease.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, description: 'Fake demo disease category.' } },
      { upsert: true, returnDocument: 'after' },
    );
  }

  const demoAccounts = [
    {
      user: { name: 'Demo Administrator', email: 'admin@carehub.demo', role: 'admin' },
    },
    {
      user: { name: 'Demo Doctor One', email: 'doctor1@carehub.demo', role: 'doctor' },
      doctor: { specialization: 'Cardiology', licenseNumber: 'DEMO-LIC-001' },
    },
    {
      user: { name: 'Demo Doctor Two', email: 'doctor2@carehub.demo', role: 'doctor' },
      doctor: { specialization: 'Endocrinology', licenseNumber: 'DEMO-LIC-002' },
    },
    ...[
      ['Demo Patient One', 'patient1@carehub.demo'],
      ['Demo Patient Two', 'patient2@carehub.demo'],
      ['Demo Patient Three', 'patient3@carehub.demo'],
      ['Demo Patient Four', 'patient4@carehub.demo'],
      ['Demo Patient Five', 'patient5@carehub.demo'],
    ].map(([name, email], index) => ({
      user: { name, email, role: 'patient' },
      patient: { doctorIndex: index % 2 },
    })),
  ];

  const users = [];
  for (const account of demoAccounts) {
    let user = await User.findOne({ email: account.user.email });
    if (!user) {
      user = await User.create({ ...account.user, password: process.env.DEMO_PASSWORD });
    }
    users.push({ account, user });
  }

  const doctors = [];
  for (const { account, user } of users.filter(({ account }) => account.doctor)) {
    let doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) {
      doctor = await Doctor.create({ userId: user._id, ...account.doctor });
    }
    doctors.push(doctor);
  }

  const diseases = await Disease.find({ name: { $in: diseaseNames } }).sort({ name: 1 });
  for (const { account, user } of users.filter(({ account }) => account.patient)) {
    const existingPatient = await Patient.findOne({ userId: user._id });
    if (!existingPatient) {
      await Patient.create({
        userId: user._id,
        doctorId: doctors[account.patient.doctorIndex]._id,
        disease: diseases[account.patient.doctorIndex]._id,
      });
    }
  }

  console.log('Fake demo accounts and profiles are ready.');
};

export default seedDemoData;
