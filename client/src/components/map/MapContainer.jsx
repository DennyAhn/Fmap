// src/components/map/MapContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import NaverMap from './NaverMap';
import MenuPanel from '../panels/MenuPanel';
import ListPanel from './ListPanel';
import ShelterDetailView from './ShelterDetailView';
import NavigationView from './NavigationView';
import WildfireLayer from './WildfireLayer';
import './MapContainer.css';
import { getSheltersNearby } from '../../services/placesApi';
import { API_BASE_URL } from '../../config/api';
import { loadWildfire } from '../../utils/wildfireNdjson';

const CATEGORIES = [
  { text: '대피소', icon: '/images/map/category/shelter.png' },
  { text: '산불 위험도', icon: '/images/map/category/warning.png' },
];

// 테스트용 화재 마커 컴포넌트
const TestFireMarkers = ({ map }) => {
  React.useEffect(() => {
    if (!map) return;
    
    console.log('🔥 [TestFireMarkers] 테스트 마커 생성 중...');
    
    // 포항 지역 테스트 좌표들
    const testCoords = [
      { lat: 36.076822856446775, lon: 129.34712215113535 },
      { lat: 36.07862465824858, lon: 129.345985787499 },
      { lat: 36.07907510869903, lon: 129.3454176056808 }
    ];
    
    const markers = [];
    
    testCoords.forEach((coord, index) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(coord.lat, coord.lon),
        map: map,
        icon: {
          content: `
            <div style="
              width: 24px;
              height: 24px;
              background: #ff3b30;
              border-radius: 50%;
              border: 2px solid #fff;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              animation: pulse 2s infinite;
            ">🔥</div>
            <style>
              @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
              }
            </style>
          `,
          anchor: new window.naver.maps.Point(12, 12)
        },
        zIndex: 1000 + index
      });
      
      markers.push(marker);
      console.log(`🔥 [TestFireMarkers] 테스트 마커 ${index + 1} 생성: (${coord.lat}, ${coord.lon})`);
    });
    
    console.log(`✅ [TestFireMarkers] ${markers.length}개 테스트 마커 생성 완료`);
    
    return () => {
      markers.forEach(marker => {
        if (marker && marker.setMap) {
          marker.setMap(null);
        }
      });
    };
  }, [map]);
  
  return null;
};

export default function MapContainer({ onEditDestination, startLocation }) {
  const [activeFilters, setActiveFilters] = useState(['대피소']); // ✅ 초기값을 '대피소'로 설정
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocationButtonActive, setIsLocationButtonActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('대피소'); // ✅ 초기값을 '대피소'로 설정
  const [listPanelData, setListPanelData] = useState([]);
  const [showListPanel, setShowListPanel] = useState(true); // ✅ 초기값을 true로 설정
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false); // ✅ 패널 확장 상태 추가
  const [showDetailView, setShowDetailView] = useState(false); // 상세 화면 표시 상태
  const [selectedShelter, setSelectedShelter] = useState(null); // 선택된 대피소
  const [showNavigationView, setShowNavigationView] = useState(false); // 네비게이션 화면 표시 상태
  const [currentLocation, setCurrentLocation] = useState(null); // 현재 위치
  
  // 산불 시각화 관련 상태
  const [mapInstance, setMapInstance] = useState(null); // 지도 인스턴스
  const [wildfireFrames, setWildfireFrames] = useState([]); // 산불 프레임 데이터
  const [showWildfireLayer, setShowWildfireLayer] = useState(false); // 산불 레이어 표시 여부

  const mapRef = useRef(null);
  const panelRef = useRef(null); // ✅ 패널 ref 추가
  const dragStartY = useRef(0); // ✅ 드래그 시작 Y 좌표
  
  // 동적 높이 계산
  const getCollapsedHeight = () => 180; // 접힌 상태 높이 (버튼이 완전히 보이도록 증가)
  const getExpandedHeight = () => Math.floor(window.innerHeight / 2); // 화면의 절반
  
  const currentPanelHeight = useRef(getCollapsedHeight()); // 초기 높이를 접힌 상태로
  
  // 현재 위치 고정 설정
  useEffect(() => {
    // 실시간 현재 위치 가져오기 (주석 처리)
    /*
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        console.log('📍 현재 위치 획득:', position.coords);
      },
      (error) => {
        console.warn('⚠️ 위치 권한 없음, 기본 위치 사용:', error);
        setCurrentLocation({
          latitude: 36.0645,
          longitude: 129.3775
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    */
    
    // 고정 현재 위치 설정
    const home_lat = 36.076548026645;
    const home_lon = 129.34011228912;
    
    setCurrentLocation({
      latitude: home_lat,
      longitude: home_lon
    });
    console.log('📍 고정 현재 위치 설정:', { latitude: home_lat, longitude: home_lon });
  }, []);

  // 산불 데이터 로딩
  useEffect(() => {
    const loadWildfireData = async () => {
      try {
        console.log('🔥 [MapContainer] 산불 데이터 로딩 시작');
        const frames = await loadWildfire('/data/wildfire.ndjson');
        console.log('🔥 [MapContainer] 로딩된 프레임 상세:', frames);
        setWildfireFrames(frames);
        console.log(`✅ [MapContainer] 산불 데이터 로딩 완료: ${frames.length}개 프레임`);
        
                 // 첫 번째 프레임 상세 정보
         if (frames.length > 0) {
           console.log('🔥 [MapContainer] 첫 번째 프레임:', frames[0]);
           // 자동 활성화 제거됨 - 사용자가 "산불 위험도" 카테고리를 직접 선택해야 함
         }
      } catch (error) {
        console.error('❌ [MapContainer] 산불 데이터 로딩 실패:', error);
        // 에러가 발생해도 다른 기능에는 영향을 주지 않음
      }
    };

    loadWildfireData();
  }, []);

  // ✅ 초기 로딩 시 대피소 데이터 자동 로드 (함수 정의 후에 배치)
  useEffect(() => {
    // 지도가 준비된 후에 데이터 로드 (여러 번 시도로 확실히 로딩)
    const timer1 = setTimeout(() => {
      console.log('🚀 첫 번째 자동 대피소 로딩 시도');
      if (selectedCategory === '대피소') {
        loadShelters();
      }
    }, 1500); // 1.5초 후 첫 번째 시도
    
    const timer2 = setTimeout(() => {
      console.log('🚀 두 번째 자동 대피소 로딩 시도 (확실히 하기 위해)');
      if (selectedCategory === '대피소' && listPanelData.length === 0) {
        loadShelters();
      }
    }, 3000); // 3초 후 두 번째 시도 (첫 번째가 실패했을 경우)
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  useEffect(() => setShowListPanel(activeFilters.length > 0), [activeFilters]);
  
  // 패널 초기 높이 설정
  useEffect(() => {
    if (panelRef.current) {
      const initialHeight = getCollapsedHeight();
      panelRef.current.style.maxHeight = `${initialHeight}px`;
      currentPanelHeight.current = initialHeight;
    }
  }, [showListPanel]);
  
  const toggleMenu = () => setIsMenuOpen((p) => !p);



  // ✅ 패널 드래그 시작
  const handleTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY;
  };

  // ✅ 패널 드래그 중
  const handleTouchMove = (e) => {
    if (!panelRef.current) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY; // 위로 드래그하면 양수
    
    // 드래그 방향에 따라 패널 높이 조정
    let newHeight = currentPanelHeight.current + deltaY;
    
    const collapsedHeight = getCollapsedHeight();
    const expandedHeight = getExpandedHeight();
    
    // 최소/최대 높이 제한
    if (newHeight < collapsedHeight) newHeight = collapsedHeight;
    if (newHeight > expandedHeight) newHeight = expandedHeight;
    
    panelRef.current.style.maxHeight = `${newHeight}px`;
    currentPanelHeight.current = newHeight;
    
    // 패널 확장 상태 업데이트 (중간점 기준)
    const midPoint = (collapsedHeight + expandedHeight) / 2;
    setIsPanelExpanded(newHeight > midPoint);
  };

  // ✅ 패널 드래그 종료
  const handleTouchEnd = () => {
    if (!panelRef.current) return;
    
    const collapsedHeight = getCollapsedHeight();
    const expandedHeight = getExpandedHeight();
    const midPoint = (collapsedHeight + expandedHeight) / 2;
    
    // 드래그 방향에 따라 자동으로 펼치거나 접기
    if (currentPanelHeight.current > midPoint) {
      // 중간점보다 위로 드래그했으면 완전히 펼치기
      panelRef.current.style.maxHeight = `${expandedHeight}px`;
      currentPanelHeight.current = expandedHeight;
      setIsPanelExpanded(true);
    } else {
      // 중간점보다 아래면 접기
      panelRef.current.style.maxHeight = `${collapsedHeight}px`;
      currentPanelHeight.current = collapsedHeight;
      setIsPanelExpanded(false);
    }
  };

  // 지도 중심 가져오기(고정 위치 기준)
  const getCenter = () => {
    // 고정 현재 위치 반환
    const home_lat = 36.076548026645;
    const home_lon = 129.34011228912;
    
    try {
      // 1) NaverMap이 getMapCenter를 노출하는 경우
      const c1 = mapRef.current?.getMapCenter?.();
      if (c1?.latitude && c1?.longitude) return { lat: c1.latitude, lng: c1.longitude };
      
      // 2) getMap().getCenter() 직접 호출
      const m = mapRef.current?.getMap?.();
      const c2 = m?.getCenter?.();
      if (c2) return { lat: c2.y, lng: c2.x };
      
      // 3) getCurrentLocation 호출
      const me = mapRef.current?.getCurrentLocation?.();
      if (me) return { lat: me.latitude, lng: me.longitude };
    } catch (error) {
      console.warn('지도 중심 좌표 가져오기 오류:', error);
    }
    
    // 4) 고정 위치 기본값
    return { lat: home_lat, lng: home_lon };
  };

  // 마커 세팅 호환
  const setMarkersCompat = (items = []) => {
    const f =
      mapRef.current?.setShelterMarkers ||
      mapRef.current?.setMarkers;
    if (typeof f === 'function') f(items);
  };

  // 최초 진입: 최신 산불 폴리곤
  useEffect(() => {
    (async () => {
      try {
        if (!API_BASE_URL) {
          console.log('API_BASE_URL이 설정되지 않아 산불 폴리곤을 로드하지 않습니다.');
          return;
        }
        
        // 타임아웃이 있는 fetch 요청
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
        
        const r = await fetch(`${API_BASE_URL}api/hazards/latest`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!r.ok) return;
        const h = await r.json();
        if (h.geojson) mapRef.current?.drawHazardGeoJSON(h.geojson);
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('산불 폴리곤 로딩 타임아웃 (무시됨)');
        } else {
          console.log('산불 폴리곤 로딩 실패 (무시됨):', error.message);
        }
      }
    })();
  }, []);

  // "대피소" 로딩 - 공공데이터 API 연동
  const loadShelters = async () => {
    console.log('🏢 대피소 데이터 로딩 시작...');
    setIsLoading(true); 
    setError(null);
    
    try {
      const c = getCenter();
      console.log('📍 현재 위치:', c);
      
      // 포항시 대피 장소 API에서 정보 가져오기
      const items = await getSheltersNearby(c, 20); // 20개까지 조회
      console.log('✅ 포항시 대피 장소 API 데이터 로드 완료:', items.length, '개');
      console.log('📋 API 대피 장소 데이터 상세:', items.slice(0, 3)); // 처음 3개 항목 확인
      
      if (!items || items.length === 0) {
        console.warn('⚠️ API에서 대피시설 데이터를 찾을 수 없습니다');
        setError('현재 위치 주변에서 대피시설 정보를 찾을 수 없습니다. API 서비스 상태를 확인하거나 잠시 후 다시 시도해주세요.');
        setListPanelData([]);
        setMarkersCompat([]);
        return;
      }
      
      // 서버에서 이미 처리된 데이터이므로 바로 사용
      console.log('📱 하단 패널에 포항시 대피 장소 데이터 설정 중...');
      setListPanelData(items);
      
      // 지도에 마커 표시
      console.log('🗺️ 지도에 포항시 대피 장소 마커 표시 중...');
      console.log('🗺️ 마커 표시할 대피 장소 목록:');
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (${item.distance || 'N/A'}) - 좌표: (${item.latitude}, ${item.longitude})`);
      });
      setMarkersCompat(items);
      
      // 지도 중심점을 현재 위치로 고정하고 적절한 줌 레벨 설정
      if (items.length > 0 && mapRef.current) {
        setTimeout(() => {
          if (mapRef.current?.getMap) {
            const map = mapRef.current.getMap();
            // 중심점을 고정 현재 위치로 설정
            map.setCenter(new window.naver.maps.LatLng(c.lat, c.lng));
            // 대피소들이 잘 보이도록 적절한 줌 레벨 설정 (대피소 거리에 따라 조정)
            map.setZoom(13); // 주변 대피소가 잘 보이는 줌 레벨
            console.log('📍 지도 중심점을 현재 위치로 고정 및 줌 레벨 조정');
          }
        }, 500);
      }
      
    } catch (e) {
      console.error('🚫 대피소 로딩 실패:', e.message);
      console.error('🚫 에러 상세:', e);
      
      // 사용자 친화적인 에러 메시지 (더미 데이터 없이)
      let errorMessage = '대피소 정보를 불러올 수 없습니다.';
      
      if (e.message.includes('CORS')) {
        errorMessage = '브라우저 보안 정책으로 인해 대피소 API에 직접 접근할 수 없습니다. 서버 사이드 프록시가 필요합니다.';
      } else if (e.message.includes('fetch') || e.message.includes('network')) {
        errorMessage = '네트워크 연결 문제로 대피소 정보를 가져올 수 없습니다.';
      } else if (e.message.includes('API') || e.message.includes('찾을 수 없습니다')) {
        errorMessage = '포항시 대피소 API에서 데이터를 제공하지 않습니다.';
      } else {
        errorMessage = '대피소 정보 서비스에 문제가 발생했습니다.';
      }
      
      setError(errorMessage);
      setListPanelData([]);
      setMarkersCompat([]);
    } finally {
      setIsLoading(false);
    }
  };

  // "산불 위험도" - 산불 시각화 레이어 토글
  const loadRisk = async () => {
    setIsLoading(true); 
    setError(null);
    
    try {
      console.log('🔥 [MapContainer] 산불 위험도 카테고리 선택');
      
      // 산불 시각화 레이어 활성화
      console.log('🔥 [MapContainer] 산불 데이터 확인:', {
        wildfireFramesLength: wildfireFrames.length,
        mapInstance: !!mapInstance,
        frames: wildfireFrames
      });
      
      if (wildfireFrames.length > 0) {
        setShowWildfireLayer(true);
        console.log('✅ [MapContainer] 산불 시각화 레이어 활성화');
        
        // 패널에 산불 정보 표시
        setListPanelData([{
          id: 'wildfire-simulation',
          name: '산불 번짐 시뮬레이션',
          description: `${wildfireFrames.length}개 프레임, ${wildfireFrames[0]?.t || 0}-${wildfireFrames[wildfireFrames.length - 1]?.t || 0}분`,
          type: 'wildfire',
          metadata: {
            frameCount: wildfireFrames.length,
            ignitionPoint: wildfireFrames[0]?.ignition
          }
        }]);
      } else {
        console.warn('⚠️ [MapContainer] 산불 데이터가 로드되지 않음');
        setError('산불 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      }

      // 기존 위험도 API도 호출 (선택적)
      try {
        if (API_BASE_URL) {
          const latest = await fetch(`${API_BASE_URL}api/hazards/latest`).then(r=>r.json());
          if (latest?.geojson) mapRef.current?.drawHazardGeoJSON(latest.geojson);

          const home_lat = 36.076548026645;
          const home_lon = 129.34011228912;
          const chk = await fetch(
            `${API_BASE_URL}api/hazards/check?lat=${home_lat}&lon=${home_lon}`
          ).then(r=>r.json());

          const riskLabel = chk.inHazard
            ? '높음(구역 내부)'
            : (chk.distanceToEdgeM < 300 ? '중간(경계 인접)' : '낮음(구역 외부)');

          // 기존 산불 정보에 위험도 정보 추가
          const currentData = [...listPanelData];
          currentData.push({
            id: 'risk-current',
            name: '현재 위치 위험도',
            address: `경계까지 거리: ${chk.distanceToEdgeM ?? '-'}m`,
            distance: riskLabel,
          });

          setListPanelData(currentData);
        }
      } catch (apiError) {
        console.warn('⚠️ [MapContainer] 기존 위험도 API 호출 실패:', apiError);
        // API 오류는 무시하고 산불 시각화만 표시
      }
    } catch (e) {
      setError(e.message || '위험도 로딩 실패');
      setListPanelData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 필터 클릭
  const handleFilterClick = async (text) => {
    if (selectedCategory === text && showListPanel) {
      setSelectedCategory(null);
      setActiveFilters([]);
      setShowListPanel(false);
      setListPanelData([]);
      setMarkersCompat([]);
      
      // 산불 레이어 비활성화
      if (text === '산불 위험도') {
        setShowWildfireLayer(false);
      }
      
      return;
    }
    setSelectedCategory(text);
    setActiveFilters([text]);
    setShowListPanel(true);
    setListPanelData([]);

    if (text === '대피소') await loadShelters();
    else if (text === '산불 위험도') await loadRisk();
  };

  // 현재 위치 버튼 (고정 좌표로 이동)
  const handleMoveToCurrent = () => {
    setIsLocationButtonActive(true);
    
    // 실시간 위치 이동 (주석 처리)
    // mapRef.current?.moveToCurrentLocation?.();
    
    // 고정 위치로 이동
    const home_lat = 36.076548026645;
    const home_lon = 129.34011228912;
    
    if (mapRef.current?.getMap) {
      const map = mapRef.current.getMap();
      const homePosition = new window.naver.maps.LatLng(home_lat, home_lon);
      // 중심점을 고정 현재 위치로 확실히 설정
      map.setCenter(homePosition);
      map.setZoom(15);
      console.log('📍 지도 중심점을 고정 현재 위치로 설정:', { home_lat, home_lon });
    }
    
    setTimeout(() => setIsLocationButtonActive(false), 1200);
  };

  // 길찾기 버튼 클릭 핸들러 (고정 출발지 사용)
  const handleRouteClick = (item) => {
    // 실시간 위치 가져오기 (주석 처리)
    /*
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sessionStorage.setItem('route_start_lat', pos.coords.latitude);
        sessionStorage.setItem('route_start_lng', pos.coords.longitude);
        sessionStorage.setItem('route_goal_lat', item.latitude);
        sessionStorage.setItem('route_goal_lng', item.longitude);
        sessionStorage.setItem('route_dest_name', encodeURIComponent(item.name));
        window.location.href = '/';
      },
      () => alert('위치 권한을 확인해주세요'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    */
    
    // 고정 출발지 좌표 사용
    const home_lat = 36.076548026645;
    const home_lon = 129.34011228912;
    
    sessionStorage.setItem('route_start_lat', home_lat);
    sessionStorage.setItem('route_start_lng', home_lon);
    sessionStorage.setItem('route_goal_lat', item.latitude);
    sessionStorage.setItem('route_goal_lng', item.longitude);
    sessionStorage.setItem('route_dest_name', encodeURIComponent(item.name));
    console.log('🗺️ 고정 출발지로 경로 설정:', { 
      start: { lat: home_lat, lng: home_lon },
      goal: { lat: item.latitude, lng: item.longitude },
      name: item.name
    });
    window.location.href = '/';
  };

  // 대피소 카드 클릭 핸들러 (지도 이동 및 패널 토글)
  const handleShelterClick = (shelter) => {
    console.log('🎯 대피소 카드 클릭:', shelter.name);
    
    if (!mapRef.current || !shelter.latitude || !shelter.longitude) {
      console.warn('지도 또는 좌표 정보가 없습니다');
      return;
    }

    try {
      const map = mapRef.current.getMap();
      if (map) {
        // 대피소 위치로 지도 이동 (부드러운 애니메이션)
        const targetPosition = new window.naver.maps.LatLng(shelter.latitude, shelter.longitude);
        
        map.panTo(targetPosition, {
          duration: 500,
          easing: 'easeOutCubic'
        });
        
        // 줌 레벨 조정 (상세 보기)
        setTimeout(() => {
          map.setZoom(16);
        }, 600);
        
        // 패널 접기 (한 번 더 클릭하면 창이 닫히는 효과)
        setTimeout(() => {
          if (isPanelExpanded) {
            handleTogglePanel(); // 패널이 확장되어 있으면 접기
          }
        }, 800);
        
        console.log('✅ 지도 이동 및 패널 토글 완료:', shelter.name);
      }
    } catch (error) {
      console.warn('⚠️ 지도 이동 실패 (무시됨):', error);
    }
  };

  // 패널 토글 핸들러 (클릭으로 패널 확장/축소) - 윈도우 창 스타일
  const handleTogglePanel = () => {
    console.log('🪟 윈도우 패널 토글 클릭!', { isPanelExpanded });
    
    if (!panelRef.current) {
      console.error('❌ panelRef가 없음!');
      return;
    }
    
    const collapsedHeight = getCollapsedHeight();
    const expandedHeight = getExpandedHeight();
    
    if (isPanelExpanded) {
      // 패널이 확장되어 있으면 접기 (윈도우 최소화)
      console.log('📥 패널 최소화:', `${collapsedHeight}px`);
      panelRef.current.style.maxHeight = `${collapsedHeight}px`;
      currentPanelHeight.current = collapsedHeight;
      setIsPanelExpanded(false);
    } else {
      // 패널이 접혀있으면 펼치기 (윈도우 복원 - 화면 1/3)
      console.log('📤 패널 복원:', `${expandedHeight}px (화면의 1/3)`);
      panelRef.current.style.maxHeight = `${expandedHeight}px`;
      currentPanelHeight.current = expandedHeight;
      setIsPanelExpanded(true);
    }
    
    console.log('✅ 윈도우 패널 토글 완료:', {
      newHeight: panelRef.current.style.maxHeight,
      isExpanded: !isPanelExpanded,
      screenHeight: window.innerHeight
    });
  };

  // 산불 예시 폴리곤 생성
  const handleCreateDemoHazard = async () => {
    try {
      // 고정 현재 위치 사용
      const home_lat = 36.076548026645;
      const home_lon = 129.34011228912;
      const base = { lat: home_lat, lon: home_lon };
      
      if (!API_BASE_URL) {
        console.warn('API_BASE_URL이 설정되지 않음');
        alert('API 서버가 설정되지 않았습니다.');
        return;
      }
      
      const r = await fetch(`${API_BASE_URL}api/hazards/predict/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center: base, radiusM: 1800 }),
      }).then(r=>r.json());
      if (r.geojson) mapRef.current?.drawHazardGeoJSON(r.geojson);
    } catch (e) {
      console.error('산불 범위 생성 오류:', e);
      alert('산불 범위 생성 실패: ' + (e.message || e));
    }
  };

  // Select 버튼 클릭 처리 (상세 화면으로 전환)
  const handleSelectShelter = (shelter) => {
    console.log('🏢 대피소 선택:', shelter.name);
    setSelectedShelter(shelter);
    setShowDetailView(true);
  };

  // 상세 화면에서 뒤로가기
  const handleBackFromDetail = () => {
    console.log('⬅️ 상세 화면에서 뒤로가기');
    setShowDetailView(false);
    setSelectedShelter(null);
  };

  // 대피소 안내 시작 (네비게이션 화면으로 전환)
  const handleStartGuidance = () => {
    console.log('🧭 대피소 안내 시작:', selectedShelter?.name);
    if (!selectedShelter) {
      alert('선택된 대피소가 없습니다.');
      return;
    }
    
    // currentLocation이 없으면 고정 위치로 설정
    if (!currentLocation) {
      const home_lat = 36.076548026645;
      const home_lon = 129.34011228912;
      setCurrentLocation({
        latitude: home_lat,
        longitude: home_lon
      });
      console.log('📍 고정 현재 위치로 설정:', { home_lat, home_lon });
    }
    
    // 상세 화면 닫고 네비게이션 화면 열기
    setShowDetailView(false);
    setShowNavigationView(true);
  };

  // 네비게이션 화면에서 뒤로가기
  const handleBackFromNavigation = () => {
    console.log('⬅️ 네비게이션에서 뒤로가기');
    setShowNavigationView(false);
    setShowDetailView(true); // 상세 화면으로 복귀
  };

  // 실제 네비게이션 시작
  const handleStartNavigation = (navigationData) => {
    console.log('🚀 실제 네비게이션 시작:', navigationData);
    // 여기에 실제 네비게이션 앱 연동 로직 추가
    // 예: 네이버맵, 카카오맵, 구글맵 등으로 연결
    alert(`${navigationData.shelter.name}으로 ${navigationData.routeType === 'walk' ? '도보' : '자동차'} 안내를 시작합니다.`);
  };

  // ─ UI ────────────────────────────────────────────────────────
  const HEADER_H = 48;

  return (
    <div className="map-container" style={{ overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100 }}>
        <div
          className="header"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 1102,
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: '1px solid #eee',
          }}
        >
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src="/images/logo_dummy.svg"
              alt="logo"
              className="logo-image"
              onError={(e) => { e.currentTarget.replaceWith(document.createTextNode('LOGO')); }}
              style={{ height: 28, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, color: '#d62828', letterSpacing: '0.2px' }}>
            포항 산불 발생!
          </div>

          <button
            type="button"
            aria-label="프"
            onClick={toggleMenu}
            style={{
              border: '1px solid #e5e7eb', background: '#fff', color: '#111',
              width: 36, height: 36, borderRadius: 10, fontWeight: 700, cursor: 'pointer',
              display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.06)',
            }}
          >
            프
          </button>
        </div>
      </div>

      {/* 지도 */}
      <div className="map-component-container">
        <NaverMap
          ref={mapRef}
          startLocation={startLocation || { lat: 36.0645, lng: 129.3775 }}
          onMapReady={setMapInstance}
        />
        
        {/* 산불 시각화 레이어 */}
        {mapInstance && wildfireFrames.length > 0 && showWildfireLayer && (
          <WildfireLayer 
            map={mapInstance} 
            frames={wildfireFrames} 
          />
        )}
        
        {/* 테스트용 즉시 마커 생성 */}
        {mapInstance && wildfireFrames.length === 0 && (
          <TestFireMarkers map={mapInstance} />
        )}
        
        
      </div>

      {/* 현재 위치 버튼 */}
      <button
        className={`move-to-current-button ${isLocationButtonActive ? 'active' : ''} ${showListPanel ? 'panel-open' : ''}`}
        onClick={handleMoveToCurrent}
        title="현재 위치로 이동"
      >
        ⦿
      </button>

      {/* 리스트 패널 */}
      <ListPanel
        isVisible={showListPanel && !showDetailView}
        selectedCategory={selectedCategory}
        listPanelData={listPanelData}
        isLoading={isLoading}
        error={error}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onRouteClick={handleRouteClick}
        onTogglePanel={handleTogglePanel}
        isPanelExpanded={isPanelExpanded}
        onShelterClick={handleShelterClick}
        onSelectShelter={handleSelectShelter}
        ref={panelRef}
      />

      {/* 대피소 상세 화면 */}
      {showDetailView && !showNavigationView && (
        <ShelterDetailView
          shelter={selectedShelter}
          onBack={handleBackFromDetail}
          onStartGuidance={handleStartGuidance}
        />
      )}

      {/* 네비게이션 화면 */}
      {showNavigationView && selectedShelter && currentLocation && (
        <NavigationView
          shelter={selectedShelter}
          onBack={handleBackFromNavigation}
          startLocation={currentLocation}
          onStartNavigation={handleStartNavigation}
        />
      )}

      <MenuPanel isOpen={isMenuOpen} onClose={toggleMenu} />
    </div>
  );
}
