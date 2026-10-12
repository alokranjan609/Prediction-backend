const router = require('express').Router();
const SavedArea = require('../models/SavedArea');
const { authenticate } = require('../middleware/auth');

// GET /api/saved-areas — list all saved areas for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const savedAreas = await SavedArea.find({ user: req.user._id })
      .sort({ savedAt: -1 })
      .select('-__v');

    res.json({ success: true, data: savedAreas });
  } catch (error) {
    console.error('Fetch saved areas error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved areas'
    });
  }
});

// GET /api/saved-areas/:id — get a specific saved area
router.get('/:id', authenticate, async (req, res) => {
  try {
    const savedArea = await SavedArea.findOne({
      _id: req.params.id,
      user: req.user._id
    }).select('-__v');

    if (!savedArea) {
      return res.status(404).json({
        success: false,
        message: 'Saved area not found'
      });
    }

    res.json({ success: true, data: savedArea });
  } catch (error) {
    console.error('Fetch single saved area error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved area details'
    });
  }
});

// POST /api/saved-areas — save a new prediction area or point
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      type,
      latitude,
      longitude,
      polygonCoordinates,
      label,
      summary,
      predictionData,
      notes
    } = req.body;

    // Extract type and data from predictionData if provided
    let areaType = type;
    let fullPrediction = predictionData || null;
    let coords = polygonCoordinates || null;
    let lat = latitude;
    let lon = longitude;
    let summaryObj = summary || null;

    if (fullPrediction) {
      if (fullPrediction.grid_results || fullPrediction.summary) {
        areaType = 'polygon';
        summaryObj = summaryObj || fullPrediction.summary || null;
        coords = coords || fullPrediction.coordinates || fullPrediction.polygonCoordinates || null;
        if (fullPrediction.centroid) {
          lat = lat ?? fullPrediction.centroid.lat;
          lon = lon ?? fullPrediction.centroid.lon;
        }
      } else if (fullPrediction.prediction) {
        areaType = 'point';
        lat = lat ?? fullPrediction.latitude;
        lon = lon ?? fullPrediction.longitude;
      }
    }

    areaType = areaType === 'point' ? 'point' : 'polygon';

    // Generate fallback title if user did not provide one
    let defaultTitle = title && title.trim() ? title.trim() : null;
    if (!defaultTitle) {
      if (areaType === 'polygon') {
        const riskLabel = summaryObj?.overall_classification ? ` (${summaryObj.overall_classification} Risk)` : '';
        defaultTitle = `Saved Polygon Area${riskLabel}`;
      } else {
        const placeName = label ? ` - ${label}` : '';
        defaultTitle = `Saved Location${placeName}`;
      }
    }

    const savedArea = await SavedArea.create({
      user: req.user._id,
      title: defaultTitle,
      type: areaType,
      latitude: lat !== undefined ? Number(lat) : undefined,
      longitude: lon !== undefined ? Number(lon) : undefined,
      polygonCoordinates: coords,
      label: label || null,
      summary: summaryObj,
      predictionData: fullPrediction,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      data: savedArea,
      message: 'Prediction area saved successfully'
    });
  } catch (error) {
    console.error('Save area error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save prediction area'
    });
  }
});

// PATCH /api/saved-areas/:id — update title or notes of a saved area
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { title, notes } = req.body;
    const updates = {};

    if (title && typeof title === 'string') {
      updates.title = title.trim();
    }
    if (notes !== undefined) {
      updates.notes = String(notes);
    }

    const savedArea = await SavedArea.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: updates },
      { new: true }
    ).select('-__v');

    if (!savedArea) {
      return res.status(404).json({
        success: false,
        message: 'Saved area not found'
      });
    }

    res.json({
      success: true,
      data: savedArea,
      message: 'Saved area updated successfully'
    });
  } catch (error) {
    console.error('Update saved area error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update saved area'
    });
  }
});

// DELETE /api/saved-areas/:id — delete a saved area
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deleted = await SavedArea.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Saved area not found'
      });
    }

    res.json({
      success: true,
      message: 'Saved area deleted successfully'
    });
  } catch (error) {
    console.error('Delete saved area error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete saved area'
    });
  }
});

module.exports = router;
