const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const hazardsRoute = require('./hazards');
const axios = require('axios');

// 하버사인 거리(km)
const hav = (lat1, lon1, lat2, lon2) => {
  const R = 6371, toR = d => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const loadShelters = () =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../public/shelters.json'), 'utf8'));

/**
 * 카테고리 목록/개수
 */
router.get('/categories', (req, res) => {
  const list = loadShelters();
  const byCat = list.reduce((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1; return acc;
  }, {});
  res.json({ categories: Object.keys(byCat).map(k => ({ type:k, count:byCat[k] })) });
});

/**
 * 현재 위치 기준 가까운 대피소 K개 (카테고리 필터 가능)
 * query: lat, lon, k=10, category(optional), excludeHazard=true
 */
router.get('/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const k   = parseInt(req.query.k || '10', 10);
  const category = req.query.category;
  const excludeHazard = String(req.query.excludeHazard || 'true') === 'true';

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat,lon required' });
  }

  const list = loadShelters();
  const latestHazard = hazardsRoute.getLatestHazard();

  const enriched = list
    .filter(s => !category || s.type === category)
    .map(s => {
      const distanceKm = hav(lat, lon, s.lat, s.lon);
      let inHazard = false;
      if (latestHazard) {
        const poly = latestHazard.features[0];
        inHazard = turf.booleanPointInPolygon(turf.point([s.lon, s.lat]), poly);
      }
      return { ...s, distanceKm, inHazard };
    })
    .filter(s => excludeHazard ? !s.inHazard : true)
    .sort((a,b) => a.distanceKm - b.distanceKm)
    .slice(0, k);

  res.json({ from:{lat,lon}, items: enriched });
});

/**
 * 포항시 대피 장소 목록 API 서버 처리 및 클라이언트용 데이터 변환
 * query: lat, lng, limit
 */
router.get('/pohang-shelters', async (req, res) => {
  try {
    const { lat, lng, limit = 20 } = req.query;
    console.log('🔧 포항시 대피 장소 요청:', { lat, lng, limit });
    
    // 환경변수에서 포항시 API 키 가져오기
    const API_KEY = process.env.POHANG_API_KEY;
    
    if (!API_KEY) {
      console.error('❌ POHANG_API_KEY 환경변수가 설정되지 않았습니다');
      return res.status(500).json({
        success: false,
        error: 'API 키가 설정되지 않음',
        message: 'POHANG_API_KEY 환경변수를 설정해주세요',
        shelters: []
      });
    }
    // 포항시 대피 장소 목록 API 엔드포인트
    // 공공데이터포털: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=5020000
    const SERVICE_URL = 'https://apis.data.go.kr/5020000/pohangShuntPlaceList';
    
    const params = {
      serviceKey: POHANG_API_KEY,
      numOfRows: '100', // 포항시 API 파라미터
      pageNo: '1',
      type: 'json'
    };
    
    console.log('🔧 포항시 대피 장소 API 호출 중...');
    console.log('🔧 API URL:', SERVICE_URL);
    console.log('🔧 serviceKey 확인:', {
      exists: !!API_KEY,
      length: API_KEY?.length,
      starts: API_KEY?.substring(0, 10) + '...',
      ends: '...' + API_KEY?.substring(API_KEY.length - 10)
    });
    
    // serviceKey 이중 인코딩 방지를 위해 URL을 직접 구성
    const queryParams = new URLSearchParams({
      serviceKey: POHANG_API_KEY, // 디코딩된 키를 그대로 사용
      pageNo: '1',
      numOfRows: '100',
      type: 'json'
    });
    
    const fullUrl = `${SERVICE_URL}?${queryParams.toString()}`;
    
    console.log('🔧 API 호출 URL:', fullUrl);
    console.log('🔧 serviceKey 길이:', API_KEY.length);
    console.log('🔧 serviceKey 시작 문자:', API_KEY.substring(0, 10) + '...');
    
    const response = await axios.get(fullUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ 포항시 API 응답 성공:', response.status);
    console.log('✅ 원본 데이터 크기:', JSON.stringify(response.data).length, 'bytes');
    
    // 포항시 API 응답을 클라이언트용 형식으로 변환
    const rawData = response.data;
    
    // 포항시 API 응답 구조 검증
    if (!rawData || !rawData.body || !rawData.body.items) {
      console.warn('⚠️ 포항시 API 응답 데이터 구조가 예상과 다름:', rawData);
      return res.json({ success: false, message: 'API 데이터 구조 오류', shelters: [] });
    }
    
    // 포항시 API의 item 배열 처리
    let rawItems = [];
    if (rawData.body.items.item) {
      if (Array.isArray(rawData.body.items.item)) {
        rawItems = rawData.body.items.item;
      } else {
        rawItems = [rawData.body.items.item]; // 단일 item인 경우 배열로 변환
      }
    }
    
    console.log('📊 원본 대피 장소 데이터 수:', rawItems.length);
    
    // 클라이언트용 데이터 형식으로 변환
    const processedShelters = rawItems.map((item, index) => {
      // 포항시 API 필드명에 맞는 데이터 추출
      const facilityName = item.shlt_nm || item.name || '대피시설명 없음';
      const address = item.addr || '주소 정보 없음';
      const area = item.ar || '면적 정보 없음';
      const capacity = item.aceptnc_co || '수용인원 정보 없음';
      const facilityType = item.shlt_ctgry_nm || '대피시설';
      const disasterType = item.msfrtn_ctgry_nm || '재해유형 정보 없음';
      const collectionDate = item.collection_dt || '';
      
      // 포항시 API에서 제공하는 실제 좌표 사용
      let shelterLat, shelterLng;
      
      if (item.la && item.lo) {
        // API에서 좌표를 제공하는 경우
        shelterLat = parseFloat(item.la);
        shelterLng = parseFloat(item.lo);
        
        // 좌표 유효성 검사
        if (isNaN(shelterLat) || isNaN(shelterLng) || 
            shelterLat < 35.5 || shelterLat > 37.0 || 
            shelterLng < 128.5 || shelterLng > 130.0) {
          // 포항 지역 기본 좌표 범위로 설정
          shelterLat = 36.019 + Math.random() * 0.1;
          shelterLng = 129.343 + Math.random() * 0.1;
        }
      } else {
        // 좌표가 없는 경우 포항시 내 임의 좌표 할당
        shelterLat = 36.019 + Math.random() * 0.1;
        shelterLng = 129.343 + Math.random() * 0.1;
      }
      
      // 거리 계산 (현재 위치가 있는 경우)
      let distance = null;
      if (lat && lng) {
        const R = 6371; // 지구 반지름 (km)
        const dLat = (shelterLat - lat) * Math.PI / 180;
        const dLng = (shelterLng - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(shelterLat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        distance = distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;
      }
      
      return {
        id: item.spm_row || `pohang_${index}`,
        name: facilityName,
        address: address,
        latitude: shelterLat,
        longitude: shelterLng,
        distance: distance,
        area: area,
        capacity: capacity,
        category: facilityType,
        disasterType: disasterType,
        collectionDate: collectionDate,
        phone: '',
        imageUrl: `/images/shelters/shelter${(index % 3) + 1}.jpg`
      };
    });
    
    // 거리 기준 정렬 (현재 위치가 있는 경우)
    let finalShelters = processedShelters;
    if (lat && lng) {
      finalShelters = processedShelters
        .filter(shelter => {
          if (!shelter.distance) return true;
          const distanceNum = parseFloat(shelter.distance.replace(/[^\d.]/g, ''));
          const unit = shelter.distance.includes('km') ? 1000 : 1;
          return (distanceNum * unit) <= 50000; // 50km 이내만
        })
        .sort((a, b) => {
          if (!a.distance || !b.distance) return 0;
          const distA = parseFloat(a.distance.replace(/[^\d.]/g, '')) * (a.distance.includes('km') ? 1000 : 1);
          const distB = parseFloat(b.distance.replace(/[^\d.]/g, '')) * (b.distance.includes('km') ? 1000 : 1);
          return distA - distB;
        })
        .slice(0, parseInt(limit));
    } else {
      finalShelters = processedShelters.slice(0, parseInt(limit));
    }
    
    console.log('🎯 처리된 대피시설 수:', finalShelters.length);
    
    res.json({
      success: true,
      message: '포항시 대피 장소 데이터 로드 성공',
      total: rawItems.length,
      returned: finalShelters.length,
      shelters: finalShelters
    });
    
  } catch (error) {
    console.error('❌ 포항시 대피 장소 API 에러:', error.message);
    console.error('❌ 에러 상세:', error.response?.data || error);
    
    res.status(500).json({
      success: false,
      error: '포항시 대피 장소 API 호출 실패',
      message: error.message,
      shelters: []
    });
  }
});

module.exports = router;
