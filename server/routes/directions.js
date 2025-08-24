// server/routes/directions.js
const express = require('express');
const router = express.Router();
const haversine = require('haversine');

// 티맵 API 기본 설정
const TMAP_BASE_URL = 'https://apis.openapi.sk.com';

/**
 * 티맵 API 키를 동적으로 가져오는 함수
 * @returns {string} - 티맵 API 키
 */
const getTmapApiKey = () => {
  const apiKey = process.env.TMAP_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [Server] TMAP_API_KEY 환경변수가 설정되지 않음');
    throw new Error('TMAP_API_KEY 환경변수를 설정해주세요');
  }
  return apiKey;
};

/**
 * 좌표 형식을 표준화하는 헬퍼 함수
 * @param {object|string} coords - 좌표 객체 또는 문자열
 * @returns {string} - "위도,경도" 형식 문자열
 */
const formatCoords = (coords) => {
  if (typeof coords === 'string') {
    return coords;
  }
  if (typeof coords === 'object' && coords.latitude && coords.longitude) {
    return `${coords.latitude},${coords.longitude}`;
  }
  if (typeof coords === 'object' && coords.lat && coords.lng) {
    return `${coords.lat},${coords.lng}`;
  }
  throw new Error('잘못된 좌표 형식입니다');
};

/**
 * 좌표 유효성 검증
 * @param {string} start - 출발지 좌표 (위도,경도)
 * @param {string} goal - 도착지 좌표 (위도,경도)
 * @returns {object} - 검증된 좌표 객체
 */
const validateCoordinates = (start, goal) => {
  const [startLat, startLng] = start.split(",").map(coord => parseFloat(coord));
  const [endLat, endLng] = goal.split(",").map(coord => parseFloat(coord));

  if ([startLat, startLng, endLat, endLng].some(coord => isNaN(coord))) {
    throw new Error("유효하지 않은 좌표값입니다.");
  }

  return {
    startX: startLng.toString(),
    startY: startLat.toString(),
    endX: endLng.toString(),
    endY: endLat.toString()
  };
};



/**
 * 경로 근처에 있는 시설물인지 확인
 * @param {object} facility - 시설물 정보 (latitude, longitude 포함)
 * @param {array} routeCoordinates - 경로 좌표 배열 [[lng, lat], ...]
 * @param {number} maxDistance - 최대 거리 (미터, 기본값 100m)
 * @returns {boolean} - 경로 근처에 있으면 true
 */
function isNearRoute(facility, routeCoordinates, maxDistance = 100) {
  const start = {
    latitude: facility.latitude,
    longitude: facility.longitude
  };

  for (const coord of routeCoordinates) {
    const end = {
      latitude: coord[1],
      longitude: coord[0]
    };

    const distance = haversine(start, end, {unit: 'meter'});

    if (distance <= maxDistance) {
      return true;
    }
  }
  return false;
}

/**
 * 도보 경로 안내 API
 * POST /api/directions/walk
 * Body: { startLat, startLng, endLat, endLng }
 */
router.post('/walk', async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;
    
    console.log('🚶 [Server] 도보 경로 요청 수신:', { startLat, startLng, endLat, endLng });
    
    if (!startLat || !startLng || !endLat || !endLng) {
      console.log('❌ [Server] 도보 경로 요청 실패: 필수 파라미터 누락');
      return res.status(400).json({
        success: false,
        error: '출발지와 도착지 좌표가 필요합니다',
        required: ['startLat', 'startLng', 'endLat', 'endLng']
      });
    }

    // 좌표 형식 검증 및 변환
    const toNum = v => (v === 0 || v === '0') ? 0 : Number(v);
    const sLat = toNum(startLat), sLng = toNum(startLng), eLat = toNum(endLat), eLng = toNum(endLng);

    if (![sLat, sLng, eLat, eLng].every(n => Number.isFinite(n))) {
      console.log('❌ [Server] 도보 경로 요청 실패: 좌표 형식 오류');
      return res.status(400).json({ 
        success: false, 
        error: '좌표 형식이 잘못되었습니다',
        received: { startLat, startLng, endLat, endLng },
        converted: { sLat, sLng, eLat, eLng }
      });
    }

    // 티맵 API 키 동적 로딩
    let TMAP_API_KEY;
    try {
      TMAP_API_KEY = getTmapApiKey();
    } catch (error) {
      console.log('❌ [Server] 티맵 API 키 로딩 실패:', error.message);
      return res.status(500).json({
        success: false,
        error: '티맵 API 키가 설정되지 않았습니다',
        message: error.message
      });
    }

    // 좌표 형식 표준화
    const startCoord = `${sLng},${sLat}`;
    const goalCoord = `${eLng},${eLat}`;
    
    console.log('🚀 [Server] 도보 경로 처리 시작 (대로우선):', {
      start: startCoord,
      goal: goalCoord,
      requestType: 'PEDESTRIAN_MAJOR_ROADS'
    });

    // 도보 경로 옵션 설정 (대로우선)
    const routeOptions = {
      startX: sLng,
      startY: sLat,
      endX: eLng,
      endY: eLat,
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      startName: '출발지',
      endName: '목적지',
      searchOption: '4', // 4: 대로우선 (큰 도로를 이용한 경로)
      angle: '0'         // 출발지 각도
    };

    // 티맵 도보 경로 API 호출
    const tmapResponse = await fetch(`${TMAP_BASE_URL}/tmap/routes/pedestrian?version=1&format=json`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'appKey': TMAP_API_KEY
      },
      body: JSON.stringify(routeOptions)
    });

    if (!tmapResponse.ok) {
      throw new Error(`티맵 API 오류: ${tmapResponse.status} ${tmapResponse.statusText}`);
    }

    const tmapData = await tmapResponse.json();
    console.log('📍 [Server] 티맵 도보 API 응답 수신');
    
    // 경로 데이터 처리 (원본 데이터 사용)
    const routeData = processPedestrianRoute(tmapData);
    
    console.log('✅ [Server] 도보 경로 처리 완료:', {
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
    console.error('❌ [Server] 도보 경로 검색 실패:', error);
    res.status(500).json({
      success: false,
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
    
    console.log('🚗 [Server] 자동차 경로 요청 수신:', { startLat, startLng, endLat, endLng });
    
    if (!startLat || !startLng || !endLat || !endLng) {
      console.log('❌ [Server] 자동차 경로 요청 실패: 필수 파라미터 누락');
      return res.status(400).json({
        success: false,
        error: '출발지와 도착지 좌표가 필요합니다',
        required: ['startLat', 'startLng', 'endLat', 'endLng']
      });
    }

    // 좌표 형식 검증 및 변환
    const toNum = v => (v === 0 || v === '0') ? 0 : Number(v);
    const sLat = toNum(startLat), sLng = toNum(startLng), eLat = toNum(endLat), eLng = toNum(endLng);

    if (![sLat, sLng, eLat, eLng].every(n => Number.isFinite(n))) {
      console.log('❌ [Server] 자동차 경로 요청 실패: 좌표 형식 오류');
      return res.status(400).json({ 
        success: false, 
        error: '좌표 형식이 잘못되었습니다',
        received: { startLat, startLng, endLat, endLng },
        converted: { sLat, sLng, eLat, eLng }
      });
    }

    // 티맵 API 키 동적 로딩
    let TMAP_API_KEY;
    try {
      TMAP_API_KEY = getTmapApiKey();
    } catch (error) {
      console.log('❌ [Server] 티맵 API 키 로딩 실패:', error.message);
      return res.status(500).json({
        success: false,
        error: '티맵 API 키가 설정되지 않았습니다',
        message: error.message
      });
    }

    // 좌표 형식 표준화
    const startCoord = `${sLng},${sLat}`;
    const goalCoord = `${eLng},${eLat}`;
    
    console.log('🚀 [Server] 자동차 경로 처리 시작 (대로우선):', {
      start: startCoord,
      goal: goalCoord,
      requestType: 'DRIVING_MAJOR_ROADS'
    });

    // 자동차 경로 옵션 설정 (대로우선)
    const routeOptions = {
      startX: sLng,
      startY: sLat,
      endX: eLng,
      endY: eLat,
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      startName: '출발지',
      endName: '목적지',
      searchOption: '4',  // 4: 대로우선 (큰 도로를 이용한 경로)
      angle: '0',         // 출발지 각도
      tollgateCarType: '1', // 1: 일반차량
      roadType: '0'       // 모든 도로 유형 허용
    };

    // 티맵 자동차 경로 API 호출
    const tmapResponse = await fetch(`${TMAP_BASE_URL}/tmap/routes?version=1&format=json`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'appKey': TMAP_API_KEY
      },
      body: JSON.stringify(routeOptions)
    });

    if (!tmapResponse.ok) {
      throw new Error(`티맵 API 오류: ${tmapResponse.status} ${tmapResponse.statusText}`);
    }

    const tmapData = await tmapResponse.json();
    console.log('📍 [Server] 티맵 자동차 API 응답 수신');
    
    // 경로 데이터 처리 (원본 데이터 사용)
    const routeData = processDrivingRoute(tmapData);
    
    console.log('✅ [Server] 자동차 경로 처리 완료:', {
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
    console.error('❌ [Server] 자동차 경로 검색 실패:', error);
    res.status(500).json({
      success: false,
      error: '자동차 경로 조회 실패',
      message: error.message,
      type: 'drive'
    });
  }
});

/**
 * 도보 경로 데이터 처리 (도로 기반 경로)
 */
function processPedestrianRoute(tmapData) {
  console.log('🔄 [Server] 도보 경로 데이터 처리 시작');
  
  try {
    if (!tmapData || !tmapData.features) {
      console.warn('⚠️ [Server] 티맵 응답에 features가 없음');
      throw new Error('티맵 API 응답 형식이 올바르지 않습니다');
    }

    // 경로 feature들을 index 기준으로 정렬하여 순서를 보장합니다.
    const features = (tmapData.features || []).sort((a, b) => (a.properties.index || 0) - (b.properties.index || 0));
    
    if (features.length === 0) {
      console.warn('⚠️ [Server] 경로 features가 비어있음');
      throw new Error('경로 데이터를 찾을 수 없습니다');
    }

    // 모든 LineString features에서 좌표 추출
    const allCoordinates = [];
    let totalDistance = 0;
    let totalTime = 0;
  const steps = [];

    console.log(`📊 [Server] 처리할 feature 수: ${features.length}`);

  features.forEach((feature, index) => {
      try {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    
        if (geometry.type === 'LineString') {
          // 모든 LineString 좌표를 순서대로 추가
          const lineCoords = geometry.coordinates || [];
          if (lineCoords.length > 0) {
            allCoordinates.push(...lineCoords);
            
            totalDistance += Number(properties.distance) || 0;
            totalTime += Number(properties.time) || 0;
            
            console.log(`  📍 LineString ${index}: ${lineCoords.length}개 좌표, 거리: ${properties.distance}m`);
          }
        } else if (geometry.type === 'Point') {
          // 시작점과 끝점 정보 수집
          const pointType = properties.pointType;
          if (pointType === 'S' || pointType === 'E') {
            const coords = geometry.coordinates;
            if (coords && coords.length >= 2) {
              const [lng, lat] = coords;
              
        steps.push({
                step: steps.length,
                instruction: pointType === 'S' ? '출발지' : '목적지',
                distance: Number(properties.distance) || 0,
                duration: Number(properties.time) || 0,
          coordinate: [lng, lat],
                type: pointType
              });
            }
          }
        }
      } catch (featureError) {
        console.warn(`⚠️ [Server] Feature ${index} 처리 중 오류:`, featureError.message);
        // 개별 feature 오류는 무시하고 계속 진행
      }
    });

    if (allCoordinates.length === 0) {
      console.warn('⚠️ [Server] 유효한 경로 좌표가 없음');
      throw new Error('유효한 경로를 찾을 수 없습니다');
    }

    // 중복 좌표 제거 (연속된 동일 좌표만)
    const coordinates = [];
    for (let i = 0; i < allCoordinates.length; i++) {
      const current = allCoordinates[i];
      const previous = allCoordinates[i - 1];
      
      // 첫 번째 좌표이거나, 이전 좌표와 다른 경우에만 추가
      if (i === 0 || !previous || current[0] !== previous[0] || current[1] !== previous[1]) {
        coordinates.push(current);
      }
    }

    // 단계별 안내가 없다면 시작점과 끝점으로 생성
    if (steps.length === 0 && coordinates.length > 0) {
      steps.push(
        {
          step: 0,
          instruction: '출발지',
          distance: 0,
          duration: 0,
          coordinate: coordinates[0],
          type: 'S'
        },
        {
          step: 1,
          instruction: '목적지',
          distance: totalDistance,
          duration: totalTime,
          coordinate: coordinates[coordinates.length - 1],
          type: 'E'
        }
      );
    }

    const processedData = {
    summary: {
        distance: Math.round(totalDistance),
        duration: Math.round(totalTime / 60),
      distanceText: formatDistance(totalDistance),
        durationText: formatDuration(totalTime)
    },
    steps: steps,
    coordinates: coordinates,
    bounds: calculateBounds(coordinates)
  };

    console.log('✅ [Server] 도보 경로 데이터 처리 완료:', {
      totalDistance: Math.round(totalDistance),
      totalDuration: Math.round(totalTime / 60),
      originalCoordinates: allCoordinates.length,
      finalCoordinates: coordinates.length,
      stepsCount: steps.length
    });

    return processedData;
  } catch (error) {
    console.error('❌ [Server] 도보 경로 데이터 처리 실패:', error.message);
    throw error;
  }
}

/**
 * 자동차 경로 데이터 처리 (도로 기반 경로)
 */
function processDrivingRoute(tmapData) {
  console.log('🔄 [Server] 자동차 경로 데이터 처리 시작');
  
  try {
    if (!tmapData || !tmapData.features) {
      console.warn('⚠️ [Server] 티맵 응답에 features가 없음');
      throw new Error('티맵 API 응답 형식이 올바르지 않습니다');
    }

    // 경로 feature들을 index 기준으로 정렬하여 순서를 보장합니다.
    const features = (tmapData.features || []).sort((a, b) => (a.properties.index || 0) - (b.properties.index || 0));
    
    if (features.length === 0) {
      console.warn('⚠️ [Server] 경로 features가 비어있음');
      throw new Error('경로 데이터를 찾을 수 없습니다');
    }

    // 모든 LineString features에서 좌표 추출
    const allCoordinates = [];
    let totalDistance = 0;
    let totalTime = 0;
  const steps = [];

    console.log(`📊 [Server] 처리할 feature 수: ${features.length}`);

  features.forEach((feature, index) => {
      try {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    
        if (geometry.type === 'LineString') {
          // 모든 LineString 좌표를 순서대로 추가
          const lineCoords = geometry.coordinates || [];
          if (lineCoords.length > 0) {
            allCoordinates.push(...lineCoords);
            
            totalDistance += Number(properties.distance) || 0;
            totalTime += Number(properties.time) || 0;
            
            console.log(`  📍 LineString ${index}: ${lineCoords.length}개 좌표, 거리: ${properties.distance}m`);
          }
        } else if (geometry.type === 'Point') {
          // 시작점과 끝점 정보 수집
          const pointType = properties.pointType;
          if (pointType === 'S' || pointType === 'E') {
            const coords = geometry.coordinates;
            if (coords && coords.length >= 2) {
              const [lng, lat] = coords;
              
        steps.push({
                step: steps.length,
                instruction: pointType === 'S' ? '출발지' : '목적지',
                distance: Number(properties.distance) || 0,
                duration: Number(properties.time) || 0,
          coordinate: [lng, lat],
                type: pointType
              });
            }
          }
        }
      } catch (featureError) {
        console.warn(`⚠️ [Server] Feature ${index} 처리 중 오류:`, featureError.message);
        // 개별 feature 오류는 무시하고 계속 진행
      }
    });

    if (allCoordinates.length === 0) {
      console.warn('⚠️ [Server] 유효한 경로 좌표가 없음');
      throw new Error('유효한 경로를 찾을 수 없습니다');
    }

    // 중복 좌표 제거 (연속된 동일 좌표만)
    const coordinates = [];
    for (let i = 0; i < allCoordinates.length; i++) {
      const current = allCoordinates[i];
      const previous = allCoordinates[i - 1];
      
      // 첫 번째 좌표이거나, 이전 좌표와 다른 경우에만 추가
      if (i === 0 || !previous || current[0] !== previous[0] || current[1] !== previous[1]) {
        coordinates.push(current);
      }
    }

    // 단계별 안내가 없다면 시작점과 끝점으로 생성
    if (steps.length === 0 && coordinates.length > 0) {
      steps.push(
        {
          step: 0,
          instruction: '출발지',
          distance: 0,
          duration: 0,
          coordinate: coordinates[0],
          type: 'S'
        },
        {
          step: 1,
          instruction: '목적지',
          distance: totalDistance,
          duration: totalTime,
          coordinate: coordinates[coordinates.length - 1],
          type: 'E'
        }
      );
    }

    const processedData = {
    summary: {
        distance: Math.round(totalDistance),
        duration: Math.round(totalTime / 60),
      distanceText: formatDistance(totalDistance),
        durationText: formatDuration(totalTime)
    },
    steps: steps,
    coordinates: coordinates,
    bounds: calculateBounds(coordinates)
  };

    console.log('✅ [Server] 자동차 경로 데이터 처리 완료:', {
      totalDistance: Math.round(totalDistance),
      totalDuration: Math.round(totalTime / 60),
      originalCoordinates: allCoordinates.length,
      finalCoordinates: coordinates.length,
      stepsCount: steps.length
    });

    return processedData;
  } catch (error) {
    console.error('❌ [Server] 자동차 경로 데이터 처리 실패:', error.message);
    throw error;
  }
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
 * @param {array} coordinates - 좌표 배열 [[lng, lat], ...]
 * @returns {object|null} - 경계 정보 또는 null
 */
function calculateBounds(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    console.warn('⚠️ [Server] 경계 계산을 위한 좌표가 없음');
    return null;
  }
  
  try {
    // 첫 번째 유효한 좌표 찾기
    let firstValidCoord = null;
    for (const coord of coordinates) {
      if (coord && coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1])) {
        firstValidCoord = coord;
        break;
      }
    }
    
    if (!firstValidCoord) {
      console.warn('⚠️ [Server] 유효한 좌표가 없음');
      return null;
    }
    
    let minLat = firstValidCoord[1];
    let maxLat = firstValidCoord[1];
    let minLng = firstValidCoord[0];
    let maxLng = firstValidCoord[0];
    
    coordinates.forEach((coord) => {
      if (coord && coord.length >= 2) {
        const [lng, lat] = coord;
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
        }
      }
  });
  
  return {
    southwest: [minLng, minLat],
    northeast: [maxLng, maxLat]
  };
  } catch (error) {
    console.error('❌ [Server] 경계 계산 실패:', error.message);
    return null;
  }
}

module.exports = router;
