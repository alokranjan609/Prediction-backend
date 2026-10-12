const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['point', 'polygon'],
    default: 'point'
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
  searchedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

searchHistorySchema.index({ user: 1, searchedAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
