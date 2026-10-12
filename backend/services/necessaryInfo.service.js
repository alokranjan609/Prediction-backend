const necessaryDataExtraction = async (weatherData) => {
  const {
    main: {
      temp,
      humidity,
    } = {},

    wind: {
      speed: windSpeed,
    } = {},

    rain,
    dt,
  } = weatherData;

  const necessaryData = {
    // OpenWeather timestamp → ISO date
    acq_date: new Date(dt * 1000).toISOString(),

    // Percentage → fraction
    Humidity_Fraction: humidity / 100,

    // Already Celsius
    Temperature_C: temp,

    // m/s → km/h
    Wind_Speed_kmh: windSpeed * 3.6,

    // Rainfall in mm
    Rainfall_mm: rain?.['1h'] ?? rain?.['3h'] ?? 0,
  };

  console.log('Data prepared for ML model:', necessaryData);

  return necessaryData;
};

module.exports = {
  necessaryDataExtraction,
};