const router = require('express').Router();
const axios = require('axios');

const AZ_HOST = 'https://atlas.microsoft.com'; // 서버에서만 호출

// Isochrone (Route Range)
router.get('/isochrone', async (req, res) => {
  const { from, minutes = 10, travelMode = 'car' } = req.query; // from="lon,lat"
  if (!from) return res.status(400).json({ error: 'from required' });

  try {
    // 참고: api-version/파라미터는 Azure Maps 최신 문서 기준으로 맞춰주세요.
    const url = `${AZ_HOST}/route/range/json?api-version=1.0&subscription-key=${process.env.AZURE_MAPS_KEY}&query=${from}&timeBudgetInSec=${minutes*60}&travelMode=${travelMode}`;
    const r = await axios.get(url);
    // r.data 의 polygons/coordinates 를 GeoJSON으로 변환하거나 그대로 전달
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'azure isochrone failed', detail: e?.response?.data || e?.message });
  }
});

// Weather (예보)
router.get('/weather', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat,lon required' });

  try {
    const url = `${AZ_HOST}/weather/forecast/hourly/json?api-version=1.1&subscription-key=${process.env.AZURE_MAPS_KEY}&query=${lat},${lon}`;
    const r = await axios.get(url);
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'azure weather failed', detail: e?.response?.data || e?.message });
  }
});

module.exports = router;
