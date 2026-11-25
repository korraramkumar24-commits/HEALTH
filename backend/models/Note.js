import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [4000, 'Recommendation cannot exceed 4000 characters.'],
    },
  },
  { timestamps: true },
);

noteSchema.index({ patientId: 1, createdAt: -1 });

const Note = mongoose.model('Note', noteSchema);

export default Note;
