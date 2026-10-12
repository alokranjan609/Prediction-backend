const axios = require('axios');

const generateGrid = async (coordinates, gridSpacing = 0.5, weather = null) => {
  const payload = {
    coordinates,
    grid_spacing: gridSpacing
  };

  if (weather) {
    payload.weather = weather;
  }

  const response = await axios.post(
    'http://127.0.0.1:8000/predict-polygon',
    payload
  );

  console.log('Polygon prediction service response:', response.data);

  return response.data;
};

module.exports = {
  generateGrid
};


