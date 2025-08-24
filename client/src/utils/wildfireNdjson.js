/**
 * NDJSON 산불 데이터 로더
 * 
 * 각 줄이 하나의 프레임을 나타내는 NDJSON 파일을 읽어서
 * 시간순으로 정렬된 산불 번짐 데이터를 반환합니다.
 */

/**
 * 산불 데이터 파일을 로드하고 파싱합니다 (JSON 배열 또는 NDJSON 지원)
 * @param {string} path - 데이터 파일 경로 (예: '/data/wildfire.ndjson')
 * @returns {Promise<Array>} 파싱된 프레임 배열
 */
export async function loadWildfire(path) {
  try {
    console.log('🔥 [WildfireLoader] 산불 데이터 로딩 시작:', path);
    
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const text = await res.text();
    const frames = [];
    
    try {
      // JSON 배열 형태로 파싱 시도
      const jsonArray = JSON.parse(text);
      if (Array.isArray(jsonArray)) {
        console.log(`📄 [WildfireLoader] JSON 배열 형태: ${jsonArray.length}개 프레임`);
        
        for (const rawFrame of jsonArray) {
          const frame = processFrame(rawFrame);
          if (frame && frame.burned.length > 0) {
            frames.push(frame);
          }
        }
      } else {
        throw new Error('Not a JSON array');
      }
    } catch (jsonError) {
      // NDJSON 형태로 파싱 시도
      console.log('📄 [WildfireLoader] NDJSON 형태로 재시도');
      
      for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        
        try {
          const j = JSON.parse(s);
          const frame = processFrame(j);
          if (frame && frame.burned.length > 0) {
            frames.push(frame);
          }
        } catch (lineError) {
          console.warn(`⚠️ [WildfireLoader] 라인 파싱 실패:`, lineError.message);
          continue;
        }
      }
    }
    
    // 시간 순서로 정렬
    const sortedFrames = frames.sort((a, b) => a.t - b.t);
    
    console.log(`✅ [WildfireLoader] 로딩 완료: ${sortedFrames.length}개 프레임, 시간 범위 ${sortedFrames[0]?.t}-${sortedFrames[sortedFrames.length-1]?.t}분`);
    
    return sortedFrames;
    
  } catch (error) {
    console.error('❌ [WildfireLoader] 로딩 실패:', error);
    throw error;
  }
}

/**
 * 개별 프레임 데이터를 처리합니다
 * @param {object} rawFrame - 원본 프레임 데이터
 * @returns {object} 처리된 프레임 객체
 */
function processFrame(rawFrame) {
  const burned = (rawFrame.burned_coordinates || [])
    .filter(p => Number(p.lat) && Number(p.lon))
    .map(p => ({ lat: +p.lat, lon: +p.lon, row: +p.row, col: +p.col }));

  const ignitionLat = +rawFrame.ignition_point?.lat || 0;
  const ignitionLon = +rawFrame.ignition_point?.lon || 0;
  
  const frame = {
    t: +rawFrame.time_minutes || 0,
    burned,
    ignition: (ignitionLat && ignitionLon) ? { lat: ignitionLat, lon: ignitionLon } : null,
    total: +rawFrame.total_burned_pixels || burned.length,
    meta: rawFrame.metadata || {},
  };

  console.log(`⏱️ [WildfireLoader] 프레임 ${frame.t}분: ${frame.burned.length}개 셀, 발화점: ${frame.ignition ? 'O' : 'X'}`);
  
  return frame;
}

/**
 * 좌표에서 사각형 셀의 4개 꼭짓점을 계산합니다
 * @param {number} lat - 중심점 위도
 * @param {number} lon - 중심점 경도  
 * @param {number} halfMeters - 반경 (미터, 기본값 25m)
 * @returns {Array<naver.maps.LatLng>} 4개 꼭짓점 (반시계방향)
 */
export function squareLatLngs(lat, lon, halfMeters = 25) {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);
  const dLat = halfMeters / mPerDegLat;
  const dLon = halfMeters / mPerDegLon;
  
  return [
    new window.naver.maps.LatLng(lat - dLat, lon - dLon), // 좌하
    new window.naver.maps.LatLng(lat - dLat, lon + dLon), // 우하
    new window.naver.maps.LatLng(lat + dLat, lon + dLon), // 우상
    new window.naver.maps.LatLng(lat + dLat, lon - dLon), // 좌상
  ];
}

/**
 * 프레임에서 셀 크기를 추정합니다
 * @param {Array} burnedCoords - burned_coordinates 배열
 * @returns {number} 추정된 반경 (미터)
 */
export function estimateCellSize(burnedCoords) {
  if (burnedCoords.length < 2) {
    return 25; // 기본값
  }
  
  let minDeltaLat = Infinity;
  let minDeltaLon = Infinity;
  
  for (let i = 0; i < burnedCoords.length; i++) {
    for (let j = i + 1; j < burnedCoords.length; j++) {
      const deltaLat = Math.abs(burnedCoords[i].lat - burnedCoords[j].lat);
      const deltaLon = Math.abs(burnedCoords[i].lon - burnedCoords[j].lon);
      
      if (deltaLat > 0 && deltaLat < minDeltaLat) {
        minDeltaLat = deltaLat;
      }
      if (deltaLon > 0 && deltaLon < minDeltaLon) {
        minDeltaLon = deltaLon;
      }
    }
  }
  
  if (minDeltaLat === Infinity || minDeltaLon === Infinity) {
    return 25; // 기본값
  }
  
  // 최소 델타의 절반을 미터로 변환
  const avgLat = burnedCoords.reduce((sum, c) => sum + c.lat, 0) / burnedCoords.length;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(avgLat * Math.PI / 180);
  
  const halfMetersFromLat = (minDeltaLat / 2) * mPerDegLat;
  const halfMetersFromLon = (minDeltaLon / 2) * mPerDegLon;
  
  const estimatedHalfMeters = Math.min(halfMetersFromLat, halfMetersFromLon);
  
  console.log(`📏 [WildfireLoader] 셀 크기 추정: ${estimatedHalfMeters.toFixed(1)}m (기본: 25m)`);
  
  return Math.max(10, Math.min(100, estimatedHalfMeters)); // 10m-100m 범위로 제한
}
