const mongoose = require('mongoose');

const savedAreaSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'Saved Prediction Area',
    trim: true
  },
  type: {
    type: String,
    enum: ['point', 'polygon'],
    default: 'polygon'
  },
  latitude: {
    type: Number,
    required: false
  },
  longitude: {
    type: Number,
    required: false
  },
  polygonCoordinates: {
    type: [[Number]],
    default: null
  },
  label: {
    type: String,
    default: null
  },
  summary: {
    type: Object,
    default: null
  },
  predictionData: {
    type: Object,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  savedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

savedAreaSchema.index({ user: 1, savedAt: -1 });

module.exports = mongoose.model('SavedArea', savedAreaSchema);
