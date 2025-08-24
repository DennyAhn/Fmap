import React, { useState, useEffect, useRef } from 'react';
import './NavigationView.css';
import { API_BASE_URL } from '../../config/api';

const NavigationView = ({ 
  shelter, 
  onBack, 
  startLocation, 
  onStartNavigation 
}) => {
  const [routeData, setRouteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRouteType, setSelectedRouteType] = useState('walk'); // 'walk' or 'drive'
  const mapRef = useRef(null);
  const navigationMapInstance = useRef(null);

  // 경로 데이터 로드
  useEffect(() => {
    if (shelter && startLocation) {
      loadRoute(selectedRouteType);
    }
  }, [shelter, startLocation, selectedRouteType]);

  // 지도 초기화
  useEffect(() => {
    if (!routeData) return;
    
    const timer = setTimeout(() => {
      if (window.naver && window.naver.maps) {
        initNavigationMap();
      } else {
        console.warn('네이버 지도 SDK 로딩 대기 중...');
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [routeData]);

  const loadRoute = async (routeType) => {
    if (!shelter || !startLocation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🗺️ 경로 로딩 시작:', {
        type: routeType,
        from: startLocation,
        to: { lat: shelter.latitude, lng: shelter.longitude }
      });

      // API_BASE_URL이 없거나 서버가 없을 경우 더미 데이터 사용
      if (!API_BASE_URL) {
        console.warn('API_BASE_URL이 설정되지 않음, 더미 데이터 사용');
        throw new Error('API 서버 연결 안됨');
      }

      // 타임아웃이 있는 fetch 요청
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
      
      const response = await fetch(`${API_BASE_URL}api/directions/${routeType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startLat: startLocation.latitude || startLocation.lat,
          startLng: startLocation.longitude || startLocation.lng,
          endLat: shelter.latitude,
          endLng: shelter.longitude
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`경로 조회 실패: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setRouteData(result.data);
        console.log('✅ 경로 데이터 로드 완료:', result.data.summary);
      } else {
        throw new Error(result.message || '경로 조회 실패');
      }

    } catch (err) {
      console.error('❌ 경로 로딩 오류:', err);
      
      let errorMessage = err.message;
      if (err.name === 'AbortError') {
        errorMessage = '경로 조회 시간이 초과되었습니다';
      }
      
      setError(errorMessage);
      
      // 오류 시 더미 데이터 사용
      setRouteData(getDummyRouteData(routeType));
    } finally {
      setIsLoading(false);
    }
  };

  const initNavigationMap = () => {
    const mapContainer = document.getElementById('navigation-map');
    if (!mapContainer || navigationMapInstance.current || !routeData) return;
    if (!window.naver || !window.naver.maps) {
      console.warn('네이버 지도 SDK가 로드되지 않음');
      return;
    }

    try {
      const startLat = startLocation?.latitude || startLocation?.lat || 36.0805;
      const startLng = startLocation?.longitude || startLocation?.lng || 129.4040;
      
      const mapOptions = {
        center: new window.naver.maps.LatLng(startLat, startLng),
        zoom: 14,
        mapTypeControl: false,
        logoControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
          style: window.naver.maps.ZoomControlStyle.SMALL
        }
      };

      navigationMapInstance.current = new window.naver.maps.Map(mapContainer, mapOptions);

      // 출발지 마커
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(
          startLocation.latitude || startLocation.lat, 
          startLocation.longitude || startLocation.lng
        ),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: 20px;
              height: 20px;
              background: #4CAF50;
              border-radius: 50%;
              border: 3px solid #fff;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          anchor: new window.naver.maps.Point(10, 10)
        }
      });

      // 도착지 마커
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shelter.latitude, shelter.longitude),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: 30px;
              height: 30px;
              background: #2196F3;
              border-radius: 50%;
              border: 3px solid #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              color: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
              🏢
            </div>
          `,
          anchor: new window.naver.maps.Point(15, 15)
        }
      });

      // 경로 라인 그리기
      if (routeData.coordinates && routeData.coordinates.length > 0) {
        const routePath = routeData.coordinates.map(coord => 
          new window.naver.maps.LatLng(coord[1], coord[0])
        );

        new window.naver.maps.Polyline({
          map: navigationMapInstance.current,
          path: routePath,
          strokeColor: selectedRouteType === 'walk' ? '#4CAF50' : '#2196F3',
          strokeWeight: 6,
          strokeOpacity: 0.8
        });

        // 지도 범위 맞추기
        const bounds = new window.naver.maps.LatLngBounds();
        routePath.forEach(point => bounds.extend(point));
        navigationMapInstance.current.fitBounds(bounds, { top: 50, right: 50, bottom: 200, left: 50 });
      }

      console.log('✅ 네비게이션 지도 초기화 완료');
    } catch (error) {
      console.error('❌ 네비게이션 지도 초기화 실패:', error);
    }
  };

  const getDummyRouteData = (routeType) => {
    const baseDistance = 520; // 미터
    const walkDuration = Math.round(baseDistance / 80); // 도보 속도 약 80m/분
    const driveDuration = Math.round(baseDistance / 600); // 자동차 속도 약 600m/분
    
    return {
      summary: {
        distance: baseDistance,
        duration: routeType === 'walk' ? walkDuration : driveDuration,
        distanceText: `${baseDistance}m`,
        durationText: `${routeType === 'walk' ? walkDuration : driveDuration}분`
      },
      steps: [],
      coordinates: []
    };
  };

  const handleRouteTypeChange = (type) => {
    setSelectedRouteType(type);
  };

  const handleStartNavigation = () => {
    console.log('🧭 네비게이션 시작:', {
      shelter: shelter.name,
      routeType: selectedRouteType,
      routeData: routeData?.summary
    });
    
    if (onStartNavigation) {
      onStartNavigation({
        shelter,
        routeType: selectedRouteType,
        routeData
      });
    }
  };

  if (!shelter) return null;

  return (
    <div className="navigation-view">
      {/* 상단 헤더 */}
      <div className="navigation-header">
        <button className="nav-back-button" onClick={onBack}>
          ←
        </button>
        <div className="nav-header-info">
          <h2 className="destination-name">{shelter.name}</h2>
          <div className="destination-distance">
            {routeData ? routeData.summary.distanceText : '계산 중...'}
          </div>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="navigation-map-section">
        <div id="navigation-map" className="navigation-map-container">
          {isLoading && (
            <div className="map-loading">
              <div className="loading-spinner"></div>
              <div>경로 계산 중...</div>
            </div>
          )}
          {error && (
            <div className="map-error">
              <div>⚠️ 경로 계산 오류</div>
              <div className="error-text">{error}</div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 경로 정보 */}
      <div className="navigation-bottom">
        {/* 경로 타입 선택 */}
        <div className="route-type-selector">
          <button 
            className={`route-type-button ${selectedRouteType === 'walk' ? 'active' : ''}`}
            onClick={() => handleRouteTypeChange('walk')}
          >
            <span className="route-icon">🚶</span>
            <span className="route-text">
              {routeData && selectedRouteType === 'walk' ? routeData.summary.durationText : '30분'}
            </span>
          </button>
          
          <button 
            className={`route-type-button ${selectedRouteType === 'drive' ? 'active' : ''}`}
            onClick={() => handleRouteTypeChange('drive')}
          >
            <span className="route-icon">🚗</span>
            <span className="route-text">
              {routeData && selectedRouteType === 'drive' ? routeData.summary.durationText : '10분'}
            </span>
          </button>
        </div>

        {/* 네비게이션 시작 버튼 */}
        <button 
          className="start-navigation-button"
          onClick={handleStartNavigation}
          disabled={isLoading}
        >
          대피소 안내 시작
        </button>
      </div>
    </div>
  );
};

export default NavigationView;
