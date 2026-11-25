import mongoose from 'mongoose';

const diseaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Disease name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Disease = mongoose.model('Disease', diseaseSchema);

export default Disease;
