const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/predict`;

/**
 * Helper function to send POST requests
 */
function postRequest(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING PREDICTION ENDPOINT TESTS ---');

  const tests = [
    {
      name: 'Valid Coordinates (Coordinate echo validation)',
      payload: { latitude: 37.7749, longitude: -122.4194 },
      expectedStatus: 200,
      validate: (response) => {
        const data = response.body.data;
        if (!response.body.success) return 'Expected success: true';
        if (data.latitude !== 37.7749) return `Expected latitude 37.7749, got ${data.latitude}`;
        if (data.longitude !== -122.4194) return `Expected longitude -122.4194, got ${data.longitude}`;
        if (!data.prediction || data.prediction.status !== 'pending_integration') {
          return `Expected prediction.status "pending_integration", got: ${JSON.stringify(data.prediction)}`;
        }
        return null; // Passes
      }
    },
    {
      name: 'Missing Parameter (longitude)',
      payload: { latitude: 37.7749 },
      expectedStatus: 400,
      validate: (response) => {
        if (response.body.success) return 'Expected success: false';
        if (!response.body.message.includes('required')) return `Expected parameter requirement error message, got: ${response.body.message}`;
        return null;
      }
    },
    {
      name: 'Invalid Coordinate Type (string)',
      payload: { latitude: 'not-a-number', longitude: -122.4194 },
      expectedStatus: 400,
      validate: (response) => {
        if (response.body.success) return 'Expected success: false';
        if (!response.body.message.includes('numeric')) return `Expected numeric warning, got: ${response.body.message}`;
        return null;
      }
    },
    {
      name: 'Out of Range Latitude (95.0)',
      payload: { latitude: 95.0, longitude: -122.4194 },
      expectedStatus: 400,
      validate: (response) => {
        if (response.body.success) return 'Expected success: false';
        if (!response.body.message.includes('Latitude must be between -90 and 90')) return `Expected latitude range warning, got: ${response.body.message}`;
        return null;
      }
    },
    {
      name: 'Out of Range Longitude (185.0)',
      payload: { latitude: 37.7749, longitude: 185.0 },
      expectedStatus: 400,
      validate: (response) => {
        if (response.body.success) return 'Expected success: false';
        if (!response.body.message.includes('Longitude must be between -180 and 180')) return `Expected longitude range warning, got: ${response.body.message}`;
        return null;
      }
    }
  ];

  let passedAll = true;
  for (const t of tests) {
    console.log(`\nTest: ${t.name}`);
    console.log(`Sending Payload:`, t.payload);
    try {
      const res = await postRequest(t.payload);
      console.log(`Response Status: ${res.statusCode}`);
      console.log(`Response Body:`, JSON.stringify(res.body || res.rawBody, null, 2));

      if (res.statusCode !== t.expectedStatus) {
        console.error(`❌ FAILED: Expected status ${t.expectedStatus}, got ${res.statusCode}`);
        passedAll = false;
        continue;
      }

      const error = t.validate(res);
      if (error) {
        console.error(`❌ FAILED Validation: ${error}`);
        passedAll = false;
      } else {
        console.log(`✅ PASSED`);
      }
    } catch (e) {
      console.error(`❌ ERROR executing test request:`, e.message);
      passedAll = false;
    }
  }

  console.log('\n----------------------------------------');
  if (passedAll) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('💥 SOME TESTS FAILED. CHECK ERRORS ABOVE. 💥');
    process.exit(1);
  }
}

// Introduce slight delay before running to make sure server listens if run in parallel environment
setTimeout(() => {
  runTests();
}, 1000);
