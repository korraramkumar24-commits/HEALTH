import mongoose from 'mongoose';

const communityHealthWorkerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+?[0-9 .()-]{7,24}$/,
    },
    serviceArea: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    languages: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
      validate: [(values) => values.length <= 10, 'At most 10 languages may be listed.'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: ([longitude, latitude] = []) =>
            Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
            && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90,
          message: 'Location coordinates must be [longitude, latitude] within valid bounds.',
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

communityHealthWorkerSchema.index({ location: '2dsphere' });
communityHealthWorkerSchema.index({ isActive: 1, serviceArea: 1 });

const CommunityHealthWorker = mongoose.model('CommunityHealthWorker', communityHealthWorkerSchema);

export default CommunityHealthWorker;
