// src/services/placesApi.js
import { API_BASE_URL } from '../config/api';

// m 단위 포맷
const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);

// 대피소 이름별 이미지 매핑
const shelterImageMapping = {
  '포항시민회관': '/images/3.png',
  '강구정보고등학교': '/images/3.png',
  '포항제철중학교': '/images/3.png',
  '포항여자고등학교': '/images/3.png',
  '포항북부청사': '/images/3.png',
  '포항시청': '/images/3.png',
  '흥해읍사무소': '/images/3.png',
  '포항정보고등학교': '/images/3.png',
  '포항실내체육관': '/images/3.png',
  // 기본 이미지
  'default': '/images/3.png'
};

// 대피소 이미지 URL 가져오기
const getShelterImageUrl = (shelterName) => {
  return shelterImageMapping[shelterName] || shelterImageMapping['default'];
};



export async function getSheltersNearby(center, k = 10) {
  console.log('🏢 대피소 데이터 로딩 시작 - 현재 위치:', center);
  console.log('🏢 요청 개수:', k);
  
  // 서버에서 처리된 대피시설 데이터 가져오기
  try {
    console.log('📡 서버 API 호출 시도...');
    const shelterData = await fetchPublicDataAPI(k, center);
    
    if (shelterData && shelterData.length > 0) {
      console.log('✅ 서버 API 성공:', shelterData.length, '개의 대피시설 데이터');
      console.log('🎯 서버에서 이미 처리된 데이터이므로 추가 처리 불필요');
      return shelterData; // 서버에서 이미 처리된 데이터이므로 바로 반환
    } else {
      console.warn('⚠️ 서버에서 빈 데이터 반환');
      throw new Error('서버에서 대피시설 데이터를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('🚫 서버 API 호출 실패:', error.message);
    
    // 서버 연결 문제인 경우
    if (error.message.includes('Failed to fetch')) {
      console.log('🔧 서버 연결 문제 - 백엔드 서버가 실행 중인지 확인하세요');
    }
    
    // 서버 API 실패 시 에러 던지기
    throw error;
  }
}

// 서버에서 처리된 포항시 대피 장소 데이터 가져오기
async function fetchPublicDataAPI(k, center) {
  console.log('📡 서버에서 포항시 대피 장소 데이터 요청 시작');
  
  // 백엔드 서버의 포항시 대피 장소 엔드포인트
  const SERVER_URL = '/api/shelters/pohang-shelters';
  
  // 현재 위치와 요청 개수를 서버에 전달
  const params = new URLSearchParams({
    lat: center.lat.toString(),
    lng: center.lng.toString(),
    limit: k.toString()
  });
  
  const url = `${SERVER_URL}?${params.toString()}`;
  
  console.log('📡 서버 엔드포인트:', SERVER_URL);
  console.log('📡 요청 파라미터:', {
    lat: center.lat,
    lng: center.lng,
    limit: k
  });
  console.log('📡 완전한 URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    }).catch(error => {
      console.warn('네트워크 요청 실패:', error);
      throw new Error('프록시 서버 연결 오류');
    });
    
    console.log('📡 응답 상태:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    console.log('📊 응답 텍스트:', text.substring(0, 500)); // 처음 500자만 로그
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON 파싱 실패:', parseError);
      throw new Error('API 응답을 JSON으로 파싱할 수 없습니다');
    }
    
    console.log('📊 서버 응답 데이터:', data);
    
    // 서버에서 처리된 응답 구조 처리
    if (!data || !data.success) {
      console.warn('⚠️ 서버 응답 실패:', data?.message || '알 수 없는 오류');
      return [];
    }
    
    if (!data.shelters || !Array.isArray(data.shelters)) {
      console.warn('⚠️ 서버 응답에 대피시설 데이터가 없음');
      return [];
    }
    
    console.log('📊 서버에서 처리된 대피시설 수:', data.shelters.length);
    console.log('📊 원본 데이터 총 개수:', data.total);
    console.log('📊 첫 번째 대피시설 샘플:', data.shelters[0]);
    
    return data.shelters;
    
  } catch (fetchError) {
    console.error('🚫 Fetch 에러:', fetchError);
    
    // CORS 문제일 가능성이 높으면 프록시 또는 다른 방법 제안
    if (fetchError.message.includes('CORS') || fetchError.message.includes('network')) {
      throw new Error('CORS 정책으로 인해 API에 접근할 수 없습니다. 개발 모드에서는 더미 데이터를 사용합니다.');
    }
    
    throw fetchError;
  }
}

// API 데이터 처리 - 현재 위치 기준 필터링
function processApiData(items, center) {
  console.log('🔍 API 데이터 처리 시작');
  console.log('🔍 현재 위치:', center);
  console.log('🔍 받은 API 아이템 수:', items.length);
  
  const shelters = items.map((item, index) => {
    console.log(`🔍 대피시설 ${index + 1} 처리:`, item);
    
    // 경상북도 API 필드명에 따른 데이터 추출
    // 웹사이트에서 확인한 필드: 민방위대피시설명칭, 주소(도로명 주소), 대피가능면적, 대피가능인원 등
    const facilityName = item['민방위대피시설명칭'] || item.name || '대피시설명 없음';
    const address = item['주소(도로명 주소)'] || item['주소(지번 주소)'] || item.address || '주소 정보 없음';
    const area = item['대피가능면적(제곱미터)'] || item.area || '면적 정보 없음';
    const capacity = item['대피 가능인원(명)'] || item.capacity || '수용인원 정보 없음';
    const facilityType = item['시설종류'] || item.type || '대피시설';
    const facilityUsage = item['시설용도(공공용 시설건물 주용도)'] || item.usage || '정보 없음';
    
    // 좌표 데이터 처리 (실제 좌표가 있으면 사용, 없으면 주소 기반 임시 좌표)
    let lat, lng;
    
    // 실제 좌표 데이터가 있는지 확인
    if (item.위도 && item.경도) {
      lat = parseFloat(item.위도);
      lng = parseFloat(item.경도);
    } else if (item.latitude && item.longitude) {
      lat = parseFloat(item.latitude);
      lng = parseFloat(item.longitude);
    } else {
      // 주소를 기반으로 지역별 대략적 좌표 할당
      const addr = address.toLowerCase();
      if (addr.includes('포항') || addr.includes('북구') || addr.includes('남구')) {
        // 포항시 지역
        lat = 36.019 + Math.random() * 0.1;
        lng = 129.343 + Math.random() * 0.1;
      } else if (addr.includes('경주')) {
        // 경주시 지역
        lat = 35.856 + Math.random() * 0.1;
        lng = 129.225 + Math.random() * 0.1;
      } else if (addr.includes('안동')) {
        // 안동시 지역
        lat = 36.568 + Math.random() * 0.1;
        lng = 128.729 + Math.random() * 0.1;
      } else {
        // 기타 경상북도 지역
        lat = 36.4 + Math.random() * 0.5;
        lng = 128.8 + Math.random() * 1.0;
      }
    }
    
    // 좌표 유효성 검사
    if (isNaN(lat) || isNaN(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) {
      console.warn('❌ 잘못된 좌표 데이터, 기본 좌표 사용:', { lat, lng, name: facilityName });
      lat = 36.076548026645; // 기본 좌표 (현재 위치)
      lng = 129.34011228912;
    }
    
    console.log(`📍 대피시설 정보:`, {
      name: facilityName,
      address: address,
      area: area,
      capacity: capacity,
      type: facilityType,
      usage: facilityUsage
    });
    
    // 현재 위치와의 거리 계산
    const distance = calculateDistance(center.lat, center.lng, lat, lng);
    
    // 100km 이내의 대피시설만 포함 (경상북도 전체 고려)
    if (distance > 100) {
      console.log(`🚫 너무 먼 대피시설 제외: ${facilityName} (${distance.toFixed(2)}km)`);
      return null;
    }
    
    const shelter = {
      id: item.연번 || `gyeongbuk_shelter_${index}`,
      name: facilityName,
      address: address,
      distance: fmtM(distance * 1000),
      latitude: lat,
      longitude: lng,
      area: area,
      capacity: capacity,
      category: facilityType,
      disasterType: '민방위 대피시설',
      facilityUsage: facilityUsage,
      phone: '',
      imageUrl: getShelterImageUrl(facilityName),
    };
    
    console.log(`✅ 처리된 대피시설: ${facilityName} - ${distance.toFixed(2)}km (${lat}, ${lng})`);
    return shelter;
  }).filter(Boolean);
  
  console.log('🎯 거리 필터링 후 대피소 수:', shelters.length);
  
  // 거리순 정렬
  const sortedShelters = shelters.sort((a, b) => {
    const distA = parseFloat(a.distance.replace(/[^\d.]/g, ''));
    const distB = parseFloat(b.distance.replace(/[^\d.]/g, ''));
    return distA - distB;
  });
  
  console.log('✅ 최종 처리된 대피소 목록:', sortedShelters.map(s => `${s.name} (${s.distance})`));
  
  return sortedShelters;
}





// 두 좌표 간의 직선거리 계산 (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 지구 반지름 (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km 단위
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

// API 테스트 함수 (개발자 도구에서 실행 가능)
window.testShelterAPI = async function() {
  console.log('🧪 경상북도 대피시설 API 연결 테스트 시작...');
  console.log('🧪 테스트 조건:');
  console.log('  - API 엔드포인트: https://api.odcloud.kr/api (경상북도 대피시설 현황)');
  console.log('  - 테스트 위치: 현재 고정 위치 (36.076548026645, 129.34011228912)');
  console.log('  - 요청 개수: 5개');
  
  try {
    const testCenter = { lat: 36.076548026645, lng: 129.34011228912 }; // 현재 고정 위치
    console.log('🧪 API 호출 중...');
    
    const result = await getSheltersNearby(testCenter, 5);
    
    console.log('🧪 API 테스트 결과:');
    console.log('  - 성공 여부:', result.length > 0 ? '✅ 성공' : '❌ 실패 (빈 데이터)');
    console.log('  - 받은 데이터 개수:', result.length);
    console.log('  - 데이터 샘플:', result.slice(0, 2));
    
    if (result.length > 0) {
      console.log('🎯 API 연결 성공! 실제 경상북도 대피시설 데이터를 받았습니다.');
    } else {
      console.log('⚠️ API에서 빈 데이터를 받았습니다.');
    }
    
    return result;
  } catch (error) {
    console.error('🧪 API 테스트 실패:', error);
    console.log('❌ API 연결에 문제가 있습니다. 에러 내용을 확인하세요.');
    return { error: error.message, details: error };
  }
};

// 직접 API 호출 테스트 함수 (포항시 대피소 API)
// 즉시 API 테스트 (브라우저에서 실행)
window.quickAPITest = async function() {
  console.log('⚡ 빠른 API 테스트 시작...');
  console.log('⚡ 브라우저 개발자 도구에서 다음 명령어로 테스트하세요:');
  console.log('   1. testServerAPI() - 포항시 대피 장소 서버 API 테스트');
  console.log('   2. testShelterAPI() - 전체 대피 장소 로딩 테스트');
  console.log('   3. quickAPITest() - 이 함수');
  console.log('');
  
  try {
    const result = await window.testServerAPI();
    if (result.error) {
      console.error('⚡ 빠른 테스트 실패:', result.error);
      console.log('💡 CORS 문제일 수 있습니다. 서버 프록시가 필요할 수 있습니다.');
    } else {
      console.log('⚡ 빠른 테스트 성공!');
    }
    return result;
  } catch (error) {
    console.error('⚡ 빠른 테스트 오류:', error);
    return { error: error.message };
  }
};

// 서버 API 테스트 함수
window.testServerAPI = async function() {
  console.log('🔧 서버 처리 포항시 대피 장소 API 테스트...');
  
  const SERVER_URL = '/api/shelters/pohang-shelters';
  const testCenter = { lat: 36.076548026645, lng: 129.34011228912 };
  const params = new URLSearchParams({
    lat: testCenter.lat.toString(),
    lng: testCenter.lng.toString(),
    limit: '5'
  });
  
  const url = `${SERVER_URL}?${params.toString()}`;
  
  console.log('🔧 서버 URL:', url);
  console.log('🔧 테스트 위치:', testCenter);
  
  try {
    console.log('🔧 프록시 API 요청 시작...');
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔧 서버 응답 상태:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('🔧 서버 응답 데이터:', data);
    
    if (data.success && data.shelters && Array.isArray(data.shelters)) {
      console.log('✅ 포항시 대피 장소 API 성공!');
      console.log('✅ 처리된 대피 장소 개수:', data.shelters.length);
      console.log('✅ 원본 데이터 총 개수:', data.total);
      console.log('✅ 첫 번째 대피 장소:', data.shelters[0]);
    } else {
      console.log('❌ 포항시 API 오류 또는 빈 데이터:', data);
    }
    
    return data;
  } catch (error) {
    console.error('🔧 서버 API 테스트 실패:', error);
    
    if (error.message.includes('Failed to fetch')) {
      console.log('💡 백엔드 서버가 실행되고 있는지 확인하세요 (포트 4000)');
    }
    
    return { error: error.message, type: 'server_error' };
  }
};

// 기존 함수와의 호환성을 위한 별칭
window.testProxyAPI = window.testServerAPI;

window.testDirectAPI = async function() {
  console.log('🔧 포항시 대피 장소 API 직접 호출 테스트...');
  console.log('⚠️ 참고: 직접 API 호출은 CORS 문제로 실패할 수 있습니다.');
  console.log('⚠️ 대신 testServerAPI()를 사용하세요.');
  
  const SERVICE_URL = 'https://apis.data.go.kr/5020000/pohangShuntPlaceList';
  
  console.log('❌ 클라이언트에서 직접 API 호출은 보안상 권장하지 않습니다.');
  console.log('❌ API 키가 노출될 수 있으며, CORS 문제가 발생할 수 있습니다.');
  console.log('✅ 대신 서버를 통한 API 호출을 사용하세요: testServerAPI()');
  
  return {
    error: '직접 API 호출은 지원하지 않습니다',
    recommendation: 'testServerAPI() 함수를 사용하세요',
    reason: '보안과 CORS 문제 방지'
  };
};
