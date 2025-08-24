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

  // 경로 캐싱 및 지도 요소 관리
  const routeCache = useRef(new Map());
  const mapElements = useRef({
    startMarker: null,
    endMarker: null,
    pathInstance: null,
    pathBorderInstance: null
  });
  const currentRouteKey = useRef(null);

  // 경로 캐싱 유틸리티 함수들
  const generateRouteKey = (startCoords, goalCoords) => {
    const startStr = `${startCoords.latitude || startCoords.lat},${startCoords.longitude || startCoords.lng}`;
    const goalStr = `${goalCoords.latitude},${goalCoords.longitude}`;
    return `${startStr}->${goalStr}`;
  };

  const getCachedRoute = (routeKey, routeType) => {
    const cacheKey = `${routeKey}_${routeType}`;
    return routeCache.current.get(cacheKey);
  };

  const setCachedRoute = (routeKey, routeType, data) => {
    const cacheKey = `${routeKey}_${routeType}`;
    routeCache.current.set(cacheKey, data);
  };

  // 지도 요소 정리 함수
  const clearMapElements = () => {
    Object.entries(mapElements.current).forEach(([key, element]) => {
      if (element) {
        if (element.setMap) {
          element.setMap(null);
        }
        mapElements.current[key] = null;
      }
    });
  };

  // 마커 크기 계산 함수
  const calculateMarkerSize = (zoomLevel) => {
    const baseSize = 32;
    const scaleFactor = Math.pow(1.2, zoomLevel - 14);
    return Math.max(16, Math.min(48, baseSize * scaleFactor));
  };

  // 마커 업데이트 함수
  const updateMarkers = () => {
    if (!navigationMapInstance.current) return;
    
    const zoom = navigationMapInstance.current.getZoom();
    const newSize = calculateMarkerSize(zoom);
    const half = newSize / 2;

    [mapElements.current.startMarker, mapElements.current.endMarker].forEach(marker => {
      if (marker) {
        const currentIcon = marker.getIcon();
        if (currentIcon && currentIcon.url) {
          marker.setIcon({
            ...currentIcon,
            size: new window.naver.maps.Size(newSize, newSize),
            scaledSize: new window.naver.maps.Size(newSize, newSize),
            anchor: new window.naver.maps.Point(half, half)
          });
        }
      }
    });
  };

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
        clearMapElements();
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

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 지도 요소 정리
      clearMapElements();
      
      // 지도 인스턴스 정리
      if (navigationMapInstance.current) {
        try {
          navigationMapInstance.current.destroy();
        } catch (e) {
          console.warn('지도 인스턴스 정리 중 오류:', e);
        }
        navigationMapInstance.current = null;
      }
      
      // 캐시 정리 (메모리 누수 방지)
      routeCache.current.clear();
      currentRouteKey.current = null;
      
      console.log('🧹 NavigationView 정리 완료');
    };
  }, []);

  const loadRoute = async (routeType) => {
    if (!shelter || !startLocation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🗺️ [${routeType}] 경로 그리기 시작`);
      
      // 캐시 확인
      const routeKey = generateRouteKey(startLocation, shelter);
      const cachedData = getCachedRoute(routeKey, routeType);
      
      let serverResponse;
      
      if (cachedData) {
        console.log(`💾 [${routeType}] 캐시된 데이터 사용 (${routeKey}) - 서버 요청 없음`);
        serverResponse = cachedData;
        
        // 캐시 사용 시에만 기존 요소 정리 (시각적 전환을 위해)
        clearMapElements();
      } else {
        console.log(`🌐 [${routeType}] 서버에서 새 데이터 요청`);
        
        // 새 요청 시에만 기존 요소 정리
        clearMapElements();
        
        // API_BASE_URL이 없거나 서버가 없을 경우 더미 데이터 사용
        if (!API_BASE_URL) {
          console.warn('API_BASE_URL이 설정되지 않음, 더미 데이터 사용');
          throw new Error('API 서버 연결 안됨');
        }

        // 타임아웃이 있는 fetch 요청
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
        
        console.log(`🌐 [${routeType}] API 요청:`, {
          endpoint: `api/directions/${routeType}`,
          start: `${startLocation.latitude || startLocation.lat},${startLocation.longitude || startLocation.lng}`,
          goal: `${shelter.latitude},${shelter.longitude}`
        });

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
          const errorData = await response.json();
          throw new Error(errorData.error || '경로 검색 실패');
        }

        serverResponse = await response.json();
        
        // 📦 캐시에 저장
        setCachedRoute(routeKey, routeType, serverResponse);
        currentRouteKey.current = routeKey;
      }
      
      console.log(`📊 [${routeType}] 응답 데이터 처리:`, {
        success: serverResponse.success,
        coordinates: serverResponse.data?.coordinates?.length || 0,
        summary: serverResponse.data?.summary || {}
      });

      if (serverResponse.success && serverResponse.data) {
        // directions.js API 응답 형식에 맞게 데이터 처리
        const routeData = {
          summary: {
            distance: serverResponse.data.summary?.distance || 0,
            duration: serverResponse.data.summary?.duration || 0,
            distanceText: serverResponse.data.summary?.distanceText || '0m',
            durationText: serverResponse.data.summary?.durationText || '0분'
          },
          steps: serverResponse.data.steps || [],
          coordinates: serverResponse.data.coordinates || [],
          bounds: serverResponse.data.bounds || null
        };
        
        setRouteData(routeData);
        console.log('✅ 경로 데이터 로드 완료:', {
          distance: routeData.summary.distanceText,
          duration: routeData.summary.durationText,
          coordinatesCount: routeData.coordinates.length,
          stepsCount: routeData.steps.length
        });
      } else {
        throw new Error(serverResponse.error || serverResponse.message || '경로 조회 실패');
      }

    } catch (err) {
      console.error('❌ 경로 로딩 오류:', err);
      
      let errorMessage = err.message;
      if (err.name === 'AbortError') {
        errorMessage = '경로 조회 시간이 초과되었습니다';
      } else if (err.message.includes('Failed to fetch')) {
        errorMessage = '서버에 연결할 수 없습니다';
      } else if (err.message.includes('NetworkError')) {
        errorMessage = '네트워크 오류가 발생했습니다';
      }
      
      // 오류 시 더미 데이터 사용
      const dummyData = getDummyRouteData(routeType);
      if (dummyData) {
        setError(`${errorMessage} (예상 경로 표시)`);
        setRouteData(dummyData);
        console.log('🔄 더미 데이터로 대체:', dummyData.summary);
      } else {
        setError(`${errorMessage} - 경로를 표시할 수 없습니다`);
        setRouteData(null);
      }
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

      // 마커 크기 계산
      const initialSize = calculateMarkerSize(navigationMapInstance.current.getZoom());
      const initialHalf = initialSize / 2;

      // 출발지 마커 (개선된 스타일)
      mapElements.current.startMarker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(
          startLocation.latitude || startLocation.lat, 
          startLocation.longitude || startLocation.lng
        ),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: ${initialSize}px;
              height: ${initialSize}px;
              background: #4CAF50;
              border-radius: 50%;
              border: 3px solid #fff;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${Math.max(12, initialSize * 0.4)}px;
              color: white;
              font-weight: bold;
            ">📍</div>
          `,
          anchor: new window.naver.maps.Point(initialHalf, initialHalf)
        },
        zIndex: 50
      });

      // 도착지 마커 (개선된 스타일)
      mapElements.current.endMarker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shelter.latitude, shelter.longitude),
        map: navigationMapInstance.current,
        icon: {
          content: `
            <div style="
              width: ${initialSize}px;
              height: ${initialSize}px;
              background: #FF5722;
              border-radius: 50%;
              border: 3px solid #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: ${Math.max(14, initialSize * 0.5)}px;
              color: white;
              font-weight: bold;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            ">🏠</div>
          `,
          anchor: new window.naver.maps.Point(initialHalf, initialHalf)
        },
        zIndex: 50
      });

      // 줌 변경 시 마커 크기 업데이트
      window.naver.maps.Event.addListener(navigationMapInstance.current, 'zoom_changed', updateMarkers);

      // 경로 라인 그리기 (개선된 스타일)
      if (routeData.coordinates && routeData.coordinates.length > 0) {
        console.log(`🎯 [${selectedRouteType}] 새 경로 생성 시작`);
        
        const pathCoordinates = routeData.coordinates;
        const path = pathCoordinates.map(coord => new window.naver.maps.LatLng(coord[1], coord[0]));

        // 모든 경로 유형에 대해 동일한 색상 사용 (지도에서 잘 보이는 색상)
        const routeColor = {
          border: '#FFFFFF',     // 테두리 색상 (흰색)
          main: '#4B89DC'        // 메인 경로 색상 (네이버 지도 스타일 파란색)
        };

        // 경로에 테두리 주기 - 더 두껍고 불투명하게 설정
        mapElements.current.pathBorderInstance = new window.naver.maps.Polyline({
          map: navigationMapInstance.current,
          path: path,
          strokeColor: routeColor.border,
          strokeWeight: 12,       // 테두리를 더 두껍게
          strokeOpacity: 1,       // 완전 불투명하게
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          zIndex: 1
        });

        // 메인 경로 그리기 - 더 선명하고 생생한 색상으로
        mapElements.current.pathInstance = new window.naver.maps.Polyline({
          map: navigationMapInstance.current,
          path: path,
          strokeColor: routeColor.main,
          strokeWeight: 6,        // 약간 더 두껍게
          strokeOpacity: 1,       // 완전 불투명하게
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          zIndex: 2
        });

        // 🗺️ 지도 뷰포트를 경로에 맞게 조정
        const bounds = new window.naver.maps.LatLngBounds();
        pathCoordinates.forEach(coord => {
          bounds.extend(new window.naver.maps.LatLng(coord[1], coord[0]));
        });
        
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
    
    try {
      // 출발지와 도착지 좌표
      const startLat = startLocation.latitude || startLocation.lat;
      const startLng = startLocation.longitude || startLocation.lng;
      const endLat = shelter.latitude;
      const endLng = shelter.longitude;
      
      // 좌표 유효성 검사
      if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || 
          !Number.isFinite(endLat) || !Number.isFinite(endLng)) {
        console.warn('⚠️ 유효하지 않은 좌표:', { startLat, startLng, endLat, endLng });
        return null;
      }
      
      // 하버사인 공식으로 직선 거리 계산
      const R = 6371000; // 지구 반지름 (미터)
      const dLat = (endLat - startLat) * Math.PI / 180;
      const dLng = (endLng - startLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const straightDistance = R * c; // 미터 단위
      
      // directions.js와 동일한 형식의 간단한 경로 생성
      const coordinates = generateSimpleRoute(startLat, startLng, endLat, endLng);
      
      // 실제 도로 거리 계산
      const roadFactor = routeType === 'walk' ? 1.3 : 1.2;
      const roadDistance = straightDistance * roadFactor;
      
      // 속도 및 시간 계산
      const walkSpeed = 70; // m/분
      const driveSpeed = 400; // m/분
      const duration = Math.round(roadDistance / (routeType === 'walk' ? walkSpeed : driveSpeed));
      
      // directions.js와 동일한 단계별 안내
      const steps = [
        {
          step: 0,
          instruction: '출발지',
          distance: 0,
          duration: 0,
          coordinate: [startLng, startLat],
          type: 'S'
        },
        {
          step: 1,
          instruction: '목적지',
          distance: Math.round(roadDistance),
          duration: duration * 60,
          coordinate: [endLng, endLat],
          type: 'E'
        }
      ];
    
    return {
      summary: {
          distance: Math.round(roadDistance),
          duration: duration,
          distanceText: roadDistance >= 1000 ? `${(roadDistance/1000).toFixed(1)}km` : `${Math.round(roadDistance)}m`,
          durationText: duration >= 60 ? `${Math.floor(duration/60)}시간 ${duration%60}분` : `${duration}분`
        },
        steps: steps,
        coordinates: coordinates,
        bounds: calculateSimpleBounds(coordinates)
      };
    } catch (error) {
      console.error('❌ 더미 데이터 생성 실패:', error);
      return null;
    }
  };

  // 차도를 따르는 경로 생성 함수 (directions.js와 호환)
  const generateSimpleRoute = (startLat, startLng, endLat, endLng) => {
    const coordinates = [];
    const numPoints = 20; // 더 많은 점으로 자연스러운 곡선
    
    // 차도를 시뮬레이션하기 위한 중간 경유점들
    const midLat1 = startLat + (endLat - startLat) * 0.3 + (Math.random() - 0.5) * 0.001;
    const midLng1 = startLng + (endLng - startLng) * 0.3 + (Math.random() - 0.5) * 0.001;
    
    const midLat2 = startLat + (endLat - startLat) * 0.7 + (Math.random() - 0.5) * 0.001;
    const midLng2 = startLng + (endLng - startLng) * 0.7 + (Math.random() - 0.5) * 0.001;
    
    // 베지어 곡선 방식으로 자연스러운 도로 형태 생성
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      
      // 3차 베지어 곡선 (시작점, 중간점1, 중간점2, 끝점)
      const lat = Math.pow(1-t, 3) * startLat + 
                  3 * Math.pow(1-t, 2) * t * midLat1 + 
                  3 * (1-t) * Math.pow(t, 2) * midLat2 + 
                  Math.pow(t, 3) * endLat;
                  
      const lng = Math.pow(1-t, 3) * startLng + 
                  3 * Math.pow(1-t, 2) * t * midLng1 + 
                  3 * (1-t) * Math.pow(t, 2) * midLng2 + 
                  Math.pow(t, 3) * endLng;
      
      coordinates.push([lng, lat]); // [경도, 위도] 순서
    }
    
    return coordinates;
  };

  // 간단한 경계 계산 함수
  const calculateSimpleBounds = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;
    
    try {
      let minLat = coordinates[0][1];
      let maxLat = coordinates[0][1];
      let minLng = coordinates[0][0];
      let maxLng = coordinates[0][0];
      
      coordinates.forEach(([lng, lat]) => {
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        }
      });
      
      return {
        southwest: [minLng, minLat],
        northeast: [maxLng, maxLat]
      };
    } catch (error) {
      console.error('❌ 경계 계산 실패:', error);
      return null;
    }
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
              <div className="route-description">대로 우선</div>
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
              <div className="route-description">대로 우선</div>
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
