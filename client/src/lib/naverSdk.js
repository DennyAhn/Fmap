export const loadNaverMapSDK = () =>
  new Promise((resolve, reject) => {
    // 이미 로드된 경우
    if (window.naver?.maps) {
      console.log('✅ 네이버 지도 SDK 이미 로드됨');
      return resolve();
    }
    
    const id = process.env.REACT_APP_NCP_CLIENT_ID;
    if (!id) {
      console.warn('⚠️ REACT_APP_NCP_CLIENT_ID 환경변수가 없습니다');
      // 개발 환경에서는 에러 대신 경고만 출력하고 resolve
      return resolve();
    }
    
    console.log('📡 네이버 지도 SDK 로딩 시작...');
    const s = document.createElement('script');
    s.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${id}&submodules=geocoder,markerclusterer`;
    s.async = true;
    s.onload = () => {
      console.log('✅ 네이버 지도 SDK 로딩 완료');
      resolve();
    };
    s.onerror = (error) => {
      console.error('❌ 네이버 지도 SDK 로딩 실패:', error);
      reject(new Error('Failed to load Naver Maps SDK'));
    };
    document.head.appendChild(s);
  });
