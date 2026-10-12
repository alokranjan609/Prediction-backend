const axios = require('axios');

const predict = async (data) => {
  const response = await axios.post(
    'http://127.0.0.1:8000/predict',
    data
  );

  console.log('ML model response:', response.data);

  return response.data;
};

module.exports = {
  predict
};