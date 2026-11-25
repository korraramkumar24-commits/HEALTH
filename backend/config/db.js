import mongoose from 'mongoose';

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('MongoDB connection failed. MONGO_URI environment variable is required.');
    throw new Error('MONGO_URI environment variable is required.');
  }

  try {
    await mongoose.connect(mongoUri);
  } catch {
    console.error('MongoDB connection failed. Verify MONGO_URI and database availability.');
    throw new Error('MongoDB connection failed. Verify MONGO_URI and database availability.');
  }

  console.log('MongoDB connected successfully.');
}

export default connectDB;
