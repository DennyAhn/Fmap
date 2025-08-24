// server/routes/directions.js
const express = require('express');
const router = express.Router();

// 티맵 API 기본 설정
const TMAP_API_KEY = process.env.TMAP_API_KEY;
const TMAP_BASE_URL = 'https://apis.openapi.sk.com';

/**
 * 도보 경로 안내 API
 * POST /api/directions/walk
 * Body: { startLat, startLng, endLat, endLng }
 */
router.post('/walk', async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;
    
    console.log('🚶 도보 경로 요청:', { startLat, startLng, endLat, endLng });
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({
        error: '출발지와 도착지 좌표가 필요합니다',
        required: ['startLat', 'startLng', 'endLat', 'endLng']
      });
    }

    if (!TMAP_API_KEY) {
      return res.status(500).json({
        error: '티맵 API 키가 설정되지 않았습니다',
        message: 'TMAP_API_KEY 환경변수를 설정해주세요'
      });
    }

    // 티맵 도보 경로 API 호출
    const tmapResponse = await fetch(`${TMAP_BASE_URL}/tmap/routes/pedestrian`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'appKey': TMAP_API_KEY
      },
      body: JSON.stringify({
        startX: startLng,
        startY: startLat,
        endX: endLng,
        endY: endLat,
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
        searchOption: '0' // 0: 최적, 1: 최단거리
      })
    });

    if (!tmapResponse.ok) {
      throw new Error(`티맵 API 오류: ${tmapResponse.status} ${tmapResponse.statusText}`);
    }

    const tmapData = await tmapResponse.json();
    
    // 경로 데이터 처리
    const routeData = processPedestrianRoute(tmapData);
    
    console.log('✅ 도보 경로 처리 완료:', {
      distance: routeData.summary.distance,
      duration: routeData.summary.duration,
      steps: routeData.steps.length
    });
    
    res.json({
      success: true,
      type: 'walk',
      data: routeData
    });

  } catch (error) {
    console.error('❌ 도보 경로 오류:', error);
    res.status(500).json({
      error: '도보 경로 조회 실패',
      message: error.message,
      type: 'walk'
    });
  }
});

/**
 * 자동차 경로 안내 API
 * POST /api/directions/drive
 * Body: { startLat, startLng, endLat, endLng }
 */
router.post('/drive', async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;
    
    console.log('🚗 자동차 경로 요청:', { startLat, startLng, endLat, endLng });
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({
        error: '출발지와 도착지 좌표가 필요합니다',
        required: ['startLat', 'startLng', 'endLat', 'endLng']
      });
    }

    if (!TMAP_API_KEY) {
      return res.status(500).json({
        error: '티맵 API 키가 설정되지 않았습니다',
        message: 'TMAP_API_KEY 환경변수를 설정해주세요'
      });
    }

    // 티맵 자동차 경로 API 호출
    const tmapResponse = await fetch(`${TMAP_BASE_URL}/tmap/routes`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'appKey': TMAP_API_KEY
      },
      body: JSON.stringify({
        startX: startLng,
        startY: startLat,
        endX: endLng,
        endY: endLat,
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
        searchOption: '0', // 0: 추천, 1: 최단거리, 2: 최단시간
        trafficInfo: 'Y' // 실시간 교통정보 반영
      })
    });

    if (!tmapResponse.ok) {
      throw new Error(`티맵 API 오류: ${tmapResponse.status} ${tmapResponse.statusText}`);
    }

    const tmapData = await tmapResponse.json();
    
    // 경로 데이터 처리
    const routeData = processDrivingRoute(tmapData);
    
    console.log('✅ 자동차 경로 처리 완료:', {
      distance: routeData.summary.distance,
      duration: routeData.summary.duration,
      steps: routeData.steps.length
    });
    
    res.json({
      success: true,
      type: 'drive',
      data: routeData
    });

  } catch (error) {
    console.error('❌ 자동차 경로 오류:', error);
    res.status(500).json({
      error: '자동차 경로 조회 실패',
      message: error.message,
      type: 'drive'
    });
  }
});

/**
 * 도보 경로 데이터 처리
 */
function processPedestrianRoute(tmapData) {
  const features = tmapData.features || [];
  const steps = [];
  let totalDistance = 0;
  let totalDuration = 0;
  const coordinates = [];

  features.forEach((feature, index) => {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    
    if (geometry.type === 'Point') {
      // 경유점/출발점/도착점
      const [lng, lat] = geometry.coordinates;
      coordinates.push([lng, lat]);
      
      if (properties.description) {
        steps.push({
          step: index,
          instruction: properties.description,
          distance: properties.distance || 0,
          duration: properties.time || 0,
          coordinate: [lng, lat],
          type: properties.pointType || 'point'
        });
      }
    } else if (geometry.type === 'LineString') {
      // 경로 라인
      const lineCoords = geometry.coordinates;
      coordinates.push(...lineCoords);
      
      totalDistance += properties.distance || 0;
      totalDuration += properties.time || 0;
    }
  });

  return {
    summary: {
      distance: Math.round(totalDistance), // 미터 단위
      duration: Math.round(totalDuration / 60), // 분 단위
      distanceText: formatDistance(totalDistance),
      durationText: formatDuration(totalDuration)
    },
    steps: steps,
    coordinates: coordinates,
    bounds: calculateBounds(coordinates)
  };
}

/**
 * 자동차 경로 데이터 처리
 */
function processDrivingRoute(tmapData) {
  const features = tmapData.features || [];
  const steps = [];
  let totalDistance = 0;
  let totalDuration = 0;
  const coordinates = [];

  features.forEach((feature, index) => {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    
    if (geometry.type === 'Point') {
      // 경유점/출발점/도착점
      const [lng, lat] = geometry.coordinates;
      coordinates.push([lng, lat]);
      
      if (properties.description) {
        steps.push({
          step: index,
          instruction: properties.description,
          distance: properties.distance || 0,
          duration: properties.time || 0,
          coordinate: [lng, lat],
          type: properties.pointType || 'point'
        });
      }
    } else if (geometry.type === 'LineString') {
      // 경로 라인
      const lineCoords = geometry.coordinates;
      coordinates.push(...lineCoords);
      
      totalDistance += properties.distance || 0;
      totalDuration += properties.time || 0;
    }
  });

  return {
    summary: {
      distance: Math.round(totalDistance), // 미터 단위
      duration: Math.round(totalDuration / 60), // 분 단위
      distanceText: formatDistance(totalDistance),
      durationText: formatDuration(totalDuration)
    },
    steps: steps,
    coordinates: coordinates,
    bounds: calculateBounds(coordinates)
  };
}

/**
 * 거리 포맷팅 (미터 → km/m)
 */
function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}

/**
 * 시간 포맷팅 (초 → 분)
 */
function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
  }
  return `${minutes}분`;
}

/**
 * 좌표 배열에서 경계 계산
 */
function calculateBounds(coordinates) {
  if (coordinates.length === 0) return null;
  
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];
  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  
  coordinates.forEach(([lng, lat]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });
  
  return {
    southwest: [minLng, minLat],
    northeast: [maxLng, maxLat]
  };
}

module.exports = router;
