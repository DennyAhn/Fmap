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
    
    // 기존 지도 인스턴스 정리
    if (navigationMapInstance.current) {
      try {
        navigationMapInstance.current.destroy();
      } catch (e) {
        console.warn('지도 인스턴스 정리 중 오류:', e);
      }
      navigationMapInstance.current = null;
    }
    
    const timer = setTimeout(() => {
      if (window.naver && window.naver.maps) {
        initNavigationMap();
      } else {
        console.warn('네이버 지도 SDK 로딩 대기 중...');
        // 지도 SDK 로딩을 재시도
        const retryTimer = setTimeout(() => {
          if (window.naver && window.naver.maps) {
            initNavigationMap();
          }
        }, 2000);
        return () => clearTimeout(retryTimer);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [routeData, selectedRouteType]);

  const loadRoute = async (routeType) => {
    if (!shelter || !startLocation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🗺️ 경로 로딩 시작:', {
        type: routeType,
        from: startLocation,
        to: { lat: shelter.latitude, lng: shelter.longitude },
        apiBaseUrl: API_BASE_URL
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
      
      setError(`${errorMessage} (더미 경로 사용)`);
      
      // 오류 시 더미 데이터 사용
      const dummyData = getDummyRouteData(routeType);
      setRouteData(dummyData);
      console.log('🔄 더미 데이터로 대체:', dummyData?.summary);
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

      // 출발지 마커 (현재 위치)
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(
          startLocation.latitude || startLocation.lat, 
          startLocation.longitude || startLocation.lng
        ),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: 24px;
              height: 24px;
              background: #4CAF50;
              border-radius: 50%;
              border: 3px solid #fff;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: white;
              font-weight: bold;
            ">📍</div>
          `,
          anchor: new window.naver.maps.Point(12, 12)
        }
      });

      // 도착지 마커 (대피소)
      new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shelter.latitude, shelter.longitude),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: 32px;
              height: 32px;
              background: #FF5722;
              border-radius: 50%;
              border: 3px solid #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              color: white;
              font-weight: bold;
              box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            ">🏠</div>
          `,
          anchor: new window.naver.maps.Point(16, 16)
        }
      });

      // 경로 라인 그리기
      if (routeData.coordinates && routeData.coordinates.length > 0) {
        console.log('🗺️ 경로 좌표 개수:', routeData.coordinates.length);
        
        const routePath = routeData.coordinates.map(coord => 
          new window.naver.maps.LatLng(coord[1], coord[0])
        );

        // 경로 타입에 따른 스타일 설정
        const routeStyle = selectedRouteType === 'walk' ? {
          strokeColor: '#4CAF50',      // 도보: 녹색
          strokeWeight: 6,             // 도보: 더 얇은 라인
          strokeOpacity: 0.8,
          strokeStyle: 'solid'
        } : {
          strokeColor: '#2196F3',      // 자동차: 파란색  
          strokeWeight: 10,            // 자동차: 더 두꺼운 라인
          strokeOpacity: 0.9,
          strokeStyle: 'solid'
        };

        const routeLine = new window.naver.maps.Polyline({
          map: navigationMapInstance.current,
          path: routePath,
          ...routeStyle
        });

        // 경로 라인에 그림자 효과 (경로 타입에 따라 다른 두께)
        const shadowWeight = selectedRouteType === 'walk' ? 10 : 14;
        new window.naver.maps.Polyline({
          map: navigationMapInstance.current,
          path: routePath,
          strokeColor: '#000000',
          strokeWeight: shadowWeight,
          strokeOpacity: 0.2,
          zIndex: 1
        });

        // 메인 경로 라인을 위로 올리기
        routeLine.setZIndex(2);

        // 지도 범위 맞추기 (여백 추가)
        const bounds = new window.naver.maps.LatLngBounds();
        routePath.forEach(point => bounds.extend(point));
        
        // 충분한 여백을 두고 경로 전체가 보이도록 설정
        navigationMapInstance.current.fitBounds(bounds, { 
          top: 80, 
          right: 40, 
          bottom: 220, 
          left: 40 
        });

        console.log('✅ 경로 라인 그리기 완료');
      } else {
        console.warn('⚠️ 경로 좌표가 없습니다');
      }

      console.log('✅ 네비게이션 지도 초기화 완료');
    } catch (error) {
      console.error('❌ 네비게이션 지도 초기화 실패:', error);
    }
  };

  const getDummyRouteData = (routeType) => {
    if (!shelter || !startLocation) return null;
    
    // 출발지와 도착지 좌표
    const startLat = startLocation.latitude || startLocation.lat;
    const startLng = startLocation.longitude || startLocation.lng;
    const endLat = shelter.latitude;
    const endLng = shelter.longitude;
    
    // 하버사인 공식으로 직선 거리 계산
    const R = 6371000; // 지구 반지름 (미터)
    const dLat = (endLat - startLat) * Math.PI / 180;
    const dLng = (endLng - startLng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightDistance = R * c; // 미터 단위
    
    // 도로 기반 경로 생성 (직선이 아닌 도로를 따라가는 경로)
    const coordinates = generateRoadBasedRoute(startLat, startLng, endLat, endLng, routeType);
    
    // 실제 도로 거리 계산 (직선 거리 * 도로 계수)
    const roadFactor = routeType === 'walk' ? 1.4 : 1.3; // 도보는 더 구불구불, 자동차는 상대적으로 직선
    const roadDistance = straightDistance * roadFactor;
    
    // 속도 및 시간 계산
    const walkSpeed = 70; // m/분 (약 4.2km/h)
    const driveSpeed = 400; // m/분 (약 24km/h, 도심 기준)
    const duration = Math.round(roadDistance / (routeType === 'walk' ? walkSpeed : driveSpeed));
    
    // 경로 단계별 안내 생성
    const steps = generateRouteSteps(coordinates, routeType, shelter.name);
    
    return {
      summary: {
        distance: Math.round(roadDistance),
        duration: duration,
        distanceText: roadDistance >= 1000 ? `${(roadDistance/1000).toFixed(1)}km` : `${Math.round(roadDistance)}m`,
        durationText: duration >= 60 ? `${Math.floor(duration/60)}시간 ${duration%60}분` : `${duration}분`
      },
      steps: steps,
      coordinates: coordinates
    };
  };

  // 도로 기반 경로 생성 함수
  const generateRoadBasedRoute = (startLat, startLng, endLat, endLng, routeType) => {
    const coordinates = [];
    
    // 시작점
    coordinates.push([startLng, startLat]);
    
    // 중간 경유점들을 도로 패턴으로 생성
    const numSegments = routeType === 'walk' ? 15 : 12; // 도보는 더 세밀한 경로
    
    for (let i = 1; i < numSegments; i++) {
      const progress = i / numSegments;
      
      // 기본 직선 보간
      let lat = startLat + (endLat - startLat) * progress;
      let lng = startLng + (endLng - startLng) * progress;
      
      // 도로 패턴 시뮬레이션 (격자형 도로망 고려)
      const gridSize = 0.002; // 약 200m 간격의 격자
      
      if (routeType === 'walk') {
        // 도보: 더 구불구불한 경로 (보도, 골목길 등)
        const walkOffset = Math.sin(progress * Math.PI * 4) * 0.001;
        const walkOffset2 = Math.cos(progress * Math.PI * 6) * 0.0008;
        
        // 격자 도로에 맞춤
        lat = Math.round(lat / gridSize) * gridSize + walkOffset;
        lng = Math.round(lng / gridSize) * gridSize + walkOffset2;
        
      } else {
        // 자동차: 주요 도로 우선 (더 직선적)
        const driveOffset = Math.sin(progress * Math.PI * 2) * 0.0005;
        
        // 더 큰 격자 (주요 도로)
        const mainRoadGrid = gridSize * 2;
        lat = Math.round(lat / mainRoadGrid) * mainRoadGrid + driveOffset;
        lng = Math.round(lng / mainRoadGrid) * mainRoadGrid;
      }
      
      coordinates.push([lng, lat]);
    }
    
    // 도착점
    coordinates.push([endLng, endLat]);
    
    return coordinates;
  };

  // 경로 단계별 안내 생성 함수
  const generateRouteSteps = (coordinates, routeType, shelterName) => {
    const steps = [];
    const totalCoords = coordinates.length;
    
    // 시작점
    steps.push({
      step: 0,
      instruction: routeType === 'walk' ? "도보로 출발합니다" : "차량으로 출발합니다",
      distance: 0,
      duration: 0,
      coordinate: coordinates[0],
      type: 'start'
    });
    
    // 중간 안내점들
    const midPoints = routeType === 'walk' ? [0.3, 0.6] : [0.4]; // 도보는 더 자주 안내
    
    midPoints.forEach((ratio, index) => {
      const coordIndex = Math.floor(totalCoords * ratio);
      const coord = coordinates[coordIndex];
      
      if (routeType === 'walk') {
        const walkInstructions = [
          "직진하여 계속 이동하세요",
          "보도를 따라 계속 걸어가세요"
        ];
        steps.push({
          step: index + 1,
          instruction: walkInstructions[index] || "목적지 방향으로 계속 이동하세요",
          distance: 0,
          duration: 0,
          coordinate: coord,
          type: 'waypoint'
        });
      } else {
        steps.push({
          step: index + 1,
          instruction: "주요 도로를 따라 계속 진행하세요",
          distance: 0,
          duration: 0,
          coordinate: coord,
          type: 'waypoint'
        });
      }
    });
    
    // 도착점
    steps.push({
      step: steps.length,
      instruction: `${shelterName}에 도착했습니다`,
      distance: 0,
      duration: 0,
      coordinate: coordinates[coordinates.length - 1],
      type: 'end'
    });
    
    return steps;
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
            <div className="route-info">
              <div className="route-type-name">도보</div>
              <div className="route-text">
                {routeData && selectedRouteType === 'walk' ? routeData.summary.durationText : '계산중...'}
              </div>
              <div className="route-description">보도 이용</div>
            </div>
          </button>
          
          <button 
            className={`route-type-button ${selectedRouteType === 'drive' ? 'active' : ''}`}
            onClick={() => handleRouteTypeChange('drive')}
          >
            <span className="route-icon">🚗</span>
            <div className="route-info">
              <div className="route-type-name">자동차</div>
              <div className="route-text">
                {routeData && selectedRouteType === 'drive' ? routeData.summary.durationText : '계산중...'}
              </div>
              <div className="route-description">차도 이용</div>
            </div>
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
