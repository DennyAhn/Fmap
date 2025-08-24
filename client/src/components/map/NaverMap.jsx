// src/components/map/NaverMap.jsx

import React, {
  useEffect, useRef, forwardRef, useImperativeHandle, useState, memo,
} from 'react';
import { loadNaverMapSDK } from '../../lib/naverSdk';

const NaverMap = memo(forwardRef(function NaverMap({
  startLocation = { lat: 36.076548026645, lng: 129.34011228912 }, // 고정 현재 위치로 변경
  startZoom = 14,
  trackMe = false,               // 현재 위치 실시간 추적 비활성화
  onReady,                       // map 준비 콜백
}, ref) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);

  const meMarkerRef = useRef(null);     // 현재 위치 마커(펄스)
  const meCircleRef = useRef(null);     // 정확도 원
  const shelterMarkersRef = useRef([]); // 대피소 마커

  const [me, setMe] = useState(null);   // {lat,lng,accuracy}

  useEffect(() => {
    (async () => {
      try {
        await loadNaverMapSDK();
        const center = new window.naver.maps.LatLng(startLocation.lat, startLocation.lng);
        const map = new window.naver.maps.Map(mapDivRef.current, {
          center, zoom: startZoom,
          zoomControl: false,              // ✅ 줌 막대 숨기기
          logoControl: false, mapDataControl: false,
          scaleControl: false,
        });
        mapRef.current = map;

        // 지도 로딩 완료 후 고정 현재 위치로 중심점 설정
        const home_lat = 36.076548026645;
        const home_lon = 129.34011228912;
        const fixedCenter = new window.naver.maps.LatLng(home_lat, home_lon);
        map.setCenter(fixedCenter);
        
        console.log('📍 지도 중심점을 고정 현재 위치로 설정:', { home_lat, home_lon });

        if (onReady) onReady(map);
      } catch (error) {
        console.warn('네이버 지도 SDK 로딩 실패:', error);
        // SDK 로딩 실패 시에도 기본 지도 div는 표시
        if (mapDivRef.current) {
          mapDivRef.current.innerHTML = `
            <div style="
              width: 100%; height: 100%; 
              background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%); 
              display: flex; 
              align-items: center; 
              justify-content: center;
              color: #666;
              font-size: 14px;
              text-align: center;
              padding: 20px;
            ">
              <div>
                <div style="font-size: 48px; margin-bottom: 16px;">🗺️</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">지도를 불러올 수 없습니다</div>
                <div style="font-size: 12px; color: #999; line-height: 1.4;">
                  네이버 지도 API 키를 확인해주세요<br/>
                  또는 네트워크 연결을 확인해주세요
                </div>
              </div>
            </div>
          `;
        }
      }
    })();
  }, []); // 최초 1회

  // 현재 위치 마커 + 정확도 원 그리기/갱신
  const drawMe = ({ lat, lng, accuracy = 30 }) => {
    if (!mapRef.current || !window.naver || !window.naver.maps) return;
    const pos = new window.naver.maps.LatLng(lat, lng);

    // 정확도 원
    if (!meCircleRef.current) {
      meCircleRef.current = new window.naver.maps.Circle({
        map: mapRef.current, center: pos, radius: accuracy,
        strokeOpacity: 0, fillOpacity: 0.18, fillColor: '#2ecc71',
      });
    } else {
      meCircleRef.current.setCenter(pos);
      meCircleRef.current.setRadius(accuracy);
    }

    // 펄싱 마커 (HTML 아이콘)
    if (!meMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'me-pin';
      el.innerHTML = '<div class="me-pulse"></div><div class="me-core"></div>';
      meMarkerRef.current = new window.naver.maps.Marker({
        map: mapRef.current,
        position: pos,
        icon: { content: el, anchor: new window.naver.maps.Point(12, 12) },
        zIndex: 1000,
      });
    } else {
      meMarkerRef.current.setPosition(pos);
    }
  };

  // 위치 추적 (주석 처리)
  useEffect(() => {
    // 실시간 위치 추적 비활성화
    return;
    
    /*
    if (!trackMe || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setMe(next);
        drawMe(next);
      },
      () => { },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
    */
  }, []);

  // 고정 현재 위치 마커 표시
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      
      const home_lat = 36.076548026645;
      const home_lon = 129.34011228912;
      
      try {
        // 고정 위치에 현재 위치 마커 표시
        drawMe({ lat: home_lat, lng: home_lon, accuracy: 20 });
        setMe({ lat: home_lat, lng: home_lon, accuracy: 20 });
        
        // 마커 표시 후 중심점을 현재 위치로 재설정
        if (mapRef.current) {
          const centerPos = new window.naver.maps.LatLng(home_lat, home_lon);
          mapRef.current.setCenter(centerPos);
        }
        
        console.log('📍 고정 현재 위치 마커 표시 및 중심점 설정:', { home_lat, home_lon });
      } catch (error) {
        console.warn('현재 위치 마커 표시 오류:', error);
      }
    }, 1000); // 지도 로딩 후 1초 대기
    
    return () => clearTimeout(timer);
  }, []);

  useImperativeHandle(ref, () => ({
    getMap() { return mapRef.current; },
    // 고정 현재 위치 반환
    getCurrentLocation() { 
      const home_lat = 36.076548026645;
      const home_lon = 129.34011228912;
      return { 
        lat: home_lat, 
        lng: home_lon, 
        latitude: home_lat, 
        longitude: home_lon,
        accuracy: 20 
      }; 
    },
    // 고정 현재 위치로 이동
    moveToCurrentLocation() {
      if (!mapRef.current) return;
      const home_lat = 36.076548026645;
      const home_lon = 129.34011228912;
      mapRef.current.setCenter(new window.naver.maps.LatLng(home_lat, home_lon));
      console.log('📍 고정 현재 위치로 지도 이동:', { home_lat, home_lon });
    },
    setShelterMarkers(items = []) {
      console.log('🏢 지도에 대피소 마커 표시:', items.length, '개');
      console.log('🗺️ 지도 인스턴스 상태:', !!mapRef.current);
      console.log('📍 첫 번째 대피소:', items[0]);
      
      // 기존 마커 제거
      shelterMarkersRef.current.forEach(mk => mk.setMap(null));
      shelterMarkersRef.current = [];
      
      if (!mapRef.current || !items.length) {
        console.warn('❌ 지도 인스턴스 또는 대피소 데이터가 없어 마커 생성을 중단합니다');
        return;
      }
      
      // 대피소 마커 생성
      shelterMarkersRef.current = items.map((shelter, index) => {
        // 커스텀 마커 HTML 생성
        const markerEl = document.createElement('div');
        markerEl.className = 'shelter-marker';
        markerEl.innerHTML = `
          <div class="shelter-marker-icon">
            <div class="shelter-icon-bg">🏢</div>
            <div class="shelter-marker-pulse"></div>
          </div>
          <div class="shelter-marker-label">${shelter.name}</div>
        `;
        
        // 마커 스타일 추가
        markerEl.style.cssText = `
          position: relative;
          cursor: pointer;
          z-index: ${1000 + index};
        `;
        
        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(shelter.latitude, shelter.longitude),
          map: mapRef.current,
          title: shelter.name,
          icon: {
            content: markerEl,
            anchor: new window.naver.maps.Point(20, 40)
          },
          zIndex: 1000 + index,
        });
        
        // 마커 클릭 시 정보창 표시
        const infoWindow = new window.naver.maps.InfoWindow({
          content: `
            <div style="
              padding: 12px 16px;
              min-width: 200px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.4;
            ">
              <div style="font-weight: 700; font-size: 14px; color: #212529; margin-bottom: 8px;">
                🏢 ${shelter.name}
              </div>
              <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">
                📍 ${shelter.distance}
              </div>
              <div style="font-size: 12px; color: #495057; margin-bottom: 6px;">
                ${shelter.address}
              </div>
              ${shelter.capacity ? `
                <div style="font-size: 11px; color: #0d6efd;">
                  👥 수용인원: ${shelter.capacity}명
                </div>
              ` : ''}
              ${shelter.area ? `
                <div style="font-size: 11px; color: #198754;">
                  📐 면적: ${shelter.area}㎡
                </div>
              ` : ''}
            </div>
          `,
          maxWidth: 300,
          backgroundColor: '#fff',
          borderColor: '#dee2e6',
          borderWidth: 1,
          anchorSize: new window.naver.maps.Size(10, 10),
          anchorSkew: true,
          anchorColor: '#fff',
          pixelOffset: new window.naver.maps.Point(0, -10)
        });
        
        // 마커 클릭 이벤트
        window.naver.maps.Event.addListener(marker, 'click', () => {
          infoWindow.open(mapRef.current, marker);
        });
        
        // 지도 클릭 시 정보창 닫기
        window.naver.maps.Event.addListener(mapRef.current, 'click', () => {
          infoWindow.close();
        });
        
        return marker;
      });
      
      console.log('✅ 대피소 마커 생성 완료:', shelterMarkersRef.current.length, '개');
    },
    drawHazardGeoJSON(fc) {
      // 필요 시 기존 폴리곤 관리…(생략: 기존 프로젝트의 구현 사용)
      if (!fc?.features?.length) return;
      const poly = fc.features[0];
      const coords = poly.geometry.coordinates[0]
        .map(([lon, lat]) => new window.naver.maps.LatLng(lat, lon));
      if (window.__hazardPolygon) window.__hazardPolygon.setMap(null);
      window.__hazardPolygon = new window.naver.maps.Polygon({
        map: mapRef.current, paths: coords,
        strokeColor: '#ff3333', strokeWeight: 2, fillColor: '#ff3333', fillOpacity: 0.25,
      });
    }
  }));

  return <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />;
}));

export default NaverMap;
