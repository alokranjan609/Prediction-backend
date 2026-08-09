const router = require('express').Router();
const mlService = require('../services/mlService');

// POST /api/predict
router.post('/', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    // Validate existence of parameters
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude parameters are required in the request body.'
      });
    }

    // Validate parameter types
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates must be valid numeric values.'
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90 degrees.'
      });
    }

    if (lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be between -180 and 180 degrees.'
      });
    }

    // Delegate to ML service to send coordinates to prediction endpoint
    const result = await mlService.sendCoordinates(lat, lon);

    // Return the response containing original inputs + results
    res.json({
      success: true,
      data: {
        latitude: lat,
        longitude: lon,
        prediction: result
      }
    });

  } catch (error) {
    console.error('Prediction endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal error occurred while processing coordinates.'
    });
  }
});

module.exports = router;
