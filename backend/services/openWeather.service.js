const axios = require('axios');

const getWeather = async (latitude, longitude) => {
  const response = await axios.get(
    'https://api.openweathermap.org/data/2.5/weather',
    {
      params: {
        lat: latitude,
        lon: longitude,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric'
      }
    }
  );

  console.log('OpenWeather response:', response.data);

  return response.data;
};

module.exports = {
  getWeather
};