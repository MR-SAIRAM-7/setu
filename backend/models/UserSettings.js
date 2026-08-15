const mongoose = require('mongoose');

const UserSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    profile: {
      type: [String],
      default: []
    },
    font: {
      type: String,
      default: 'serif',
      enum: ['serif', 'system', 'hyper', 'dyslexic']
    },
    textSize: {
      type: String,
      default: 'normal',
      enum: ['normal', 'comfortable', 'large']
    },
    motion: {
      type: String,
      default: 'move',
      enum: ['move', 'still']
    },
    onboardingDone: {
      type: Boolean,
      default: false
    },
    shortcuts: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema);
