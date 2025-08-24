// server/routes/hazards.js
const router = require('express').Router();
const turf = require('@turf/turf');

// 서버 메모리에 최신 위험 폴리곤(GeoJSON) 보관 (PoC용)
let latestHazard = null;

/**
 * [POST] /api/hazards/predict/run
 * body: { center: { lat, lon }, radiusM: number, steps?: number }
 * - center: 원형의 중심 좌표
 * - radiusM: 반경(미터)
 * - steps: 원을 근사하는 다각형의 꼭짓점 수(기본 64; 높일수록 둥글고 무거움)
 */
router.post('/predict/run', (req, res) => {
  const center = req.body?.center ?? { lat: 37.5665, lon: 126.9780 };
  const radiusM = Number(req.body?.radiusM ?? 1800);
  const steps = Math.max(16, Math.min(256, Number(req.body?.steps ?? 64)));

  // 유효성 검사
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lon)) {
    return res.status(400).json({ error: 'center.lat / center.lon 이 필요합니다.' });
  }
  if (!Number.isFinite(radiusM) || radiusM <= 0) {
    return res.status(400).json({ error: 'radiusM 은 양의 숫자여야 합니다.' });
  }

  // turf.circle의 radius 단위는 km 이므로 m -> km 변환
  const centerPoint = turf.point([center.lon, center.lat]); // GeoJSON은 [lon, lat] 순서
  const circlePolygon = turf.circle(centerPoint, radiusM / 1000, {
    units: 'kilometers',
    steps,
  });

  // 필요 시 메타/타임스탬프를 함께 저장
  latestHazard = turf.featureCollection([circlePolygon]);

  return res.json({
    ok: true,
    meta: { createdAt: new Date().toISOString(), center, radiusM, steps },
    geojson: latestHazard,
  });
});

/**
 * [GET] /api/hazards/latest
 * - 최신 위험 폴리곤(GeoJSON) 조회
 */
router.get('/latest', (_req, res) => {
  res.json({ geojson: latestHazard });
});

/**
 * [GET] /api/hazards/check?lat=&lon=
 * - 좌표가 위험 폴리곤 안/밖인지와 경계까지의 거리를 반환
 */
router.get('/check', (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat, lon 쿼리가 필요합니다.' });
  }
  if (!latestHazard) {
    return res.json({ inHazard: false, distanceToEdgeM: null, risk: 'none' });
  }

  const pt = turf.point([lon, lat]);
  const poly = latestHazard.features[0];

  const inside = turf.booleanPointInPolygon(pt, poly);

  // 경계까지 거리(km) -> m 로 변환
  const line = turf.polygonToLine(poly);
  const nearest = turf.nearestPointOnLine(line, pt);
  const distanceKm = turf.distance(pt, nearest, { units: 'kilometers' });
  const distanceM = Math.round(distanceKm * 1000);

  res.json({
    inHazard: inside,
    distanceToEdgeM: distanceM,
    risk: inside ? 'high' : distanceM < 300 ? 'med' : 'low',
  });
});

// 다른 라우터에서 최신 폴리곤에 접근할 수 있게 getter 노출(대피소 필터 등에서 사용)
module.exports = router;
module.exports.getLatestHazard = () => latestHazard;
