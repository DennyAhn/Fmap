const router = require('express').Router();
const axios = require('axios');

const NCP_HOST = 'https://naveropenapi.apigw.ntruss.com';

router.get('/routes', async (req, res) => {
  const { from, to, option = 'trafast' } = req.query;
  // from, to = "lon,lat"
  if (!from || !to) return res.status(400).json({ error: 'from,to required' });

  try {
    const url = `${NCP_HOST}/map-direction/v1/driving?start=${from}&goal=${to}&option=${option}`;
    const r = await axios.get(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': process.env.NCP_API_KEY_ID,
        'X-NCP-APIGW-API-KEY': process.env.NCP_API_KEY,
      }
    });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: 'naver routes failed', detail: e?.response?.data || e?.message });
  }
});

module.exports = router;
