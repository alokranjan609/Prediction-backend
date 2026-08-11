const router = require('express').Router();
const openWeather = require('../services/openWeather.service');


const { authenticate } = require('../middleware/auth');
// /api/predict
router.post('/', authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude parameters are required in the request body.'
      });
    }
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates must be valid numeric values.'
      });
    }
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

    await openWeather.getWeather(lat, lon);

    res.json({ success: true, message: 'Coordinates sent to OpenWeather.' });

  } catch (error) {
    console.error('Prediction endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'An internal error occurred while processing coordinates.'
    });
  }
});

module.exports = router;
