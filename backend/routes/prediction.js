const router = require('express').Router();
const openWeather = require('../services/openWeather.service');
const { necessaryDataExtraction } = require('../services/necessaryInfo.service');
const mlService = require('../services/mlService');
const SearchHistory = require('../models/SearchHistory');

const { authenticate } = require('../middleware/auth');
const gridService = require('../services/gridService');

// POST /api/predict
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

    const weatherData = await openWeather.getWeather(lat, lon);
    const necessaryData = await necessaryDataExtraction(weatherData);

    const prediction = await mlService.predict(necessaryData);

    const label = weatherData?.name || null;
    await SearchHistory.findOneAndUpdate(
      { user: req.user._id, latitude: lat, longitude: lon, type: 'point' },
      {
        user: req.user._id,
        type: 'point',
        latitude: lat,
        longitude: lon,
        label,
        summary: prediction,
        searchedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true,
       data: {
        latitude: lat,
        longitude: lon,
        weather: weatherData,
        modelInput: necessaryData,
        prediction
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

// POST /api/predict/polygon
router.post('/polygon', authenticate, async (req, res) => {
  try {
    const { coordinates, grid_spacing } = req.body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A coordinates array with at least 3 [latitude, longitude] pairs is required.'
      });
    }

    for (let i = 0; i < coordinates.length; i++) {
      const point = coordinates[i];
      if (!Array.isArray(point) || point.length !== 2) {
        return res.status(400).json({
          success: false,
          message: `Coordinate at index ${i} must be a [latitude, longitude] pair.`
        });
      }

      const [lat, lon] = point.map(Number);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({
          success: false,
          message: `Coordinate at index ${i} contains invalid latitude or longitude.`
        });
      }
    }

    // Grid spacing defaults to 0.5 if not provided or invalid
    const spacing = (grid_spacing !== undefined && !isNaN(Number(grid_spacing)) && Number(grid_spacing) > 0)
      ? Number(grid_spacing)
      : 0.5;

    // Calculate polygon centroid (center latitude and longitude)
    const sumLat = coordinates.reduce((sum, p) => sum + Number(p[0]), 0);
    const sumLon = coordinates.reduce((sum, p) => sum + Number(p[1]), 0);
    const centerLat = sumLat / coordinates.length;
    const centerLon = sumLon / coordinates.length;

    // Fetch live weather data for the polygon centroid
    let weatherForModel = null;
    try {
      const weatherData = await openWeather.getWeather(centerLat, centerLon);
      const necessaryData = await necessaryDataExtraction(weatherData);

      weatherForModel = {
        temp: necessaryData.Temperature_C,
        humidity: necessaryData.Humidity_Fraction,
        wind: necessaryData.Wind_Speed_kmh,
        rainfall: necessaryData.Rainfall_mm
      };
    } catch (weatherErr) {
      console.warn('Live weather fetch for polygon centroid failed, fallback will be used:', weatherErr.message);
    }

    const gridResult = await gridService.generateGrid(coordinates, spacing, weatherForModel);

    // Save polygon search to user search history automatically
    try {
      await SearchHistory.create({
        user: req.user._id,
        type: 'polygon',
        polygonCoordinates: coordinates,
        latitude: centerLat,
        longitude: centerLon,
        summary: gridResult?.summary || null,
        searchedAt: new Date()
      });
    } catch (historyErr) {
      console.warn('Failed to record polygon search history:', historyErr.message);
    }

    res.json({
      success: true,
      data: {
        centroid: { lat: centerLat, lon: centerLon },
        weather_used: weatherForModel,
        ...gridResult
      }
    });


  } catch (error) {
    console.error('Polygon grid endpoint error:', error?.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error?.response?.data?.detail || 'An internal error occurred while processing polygon coordinates.'
    });
  }
});

module.exports = router;


