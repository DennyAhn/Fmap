import React, { useEffect, useRef } from 'react';
import './ShelterDetailView.css';

const ShelterDetailView = ({ shelter, onBack, onStartGuidance }) => {
  const mapRef = useRef(null);
  const detailMapInstance = useRef(null);

  useEffect(() => {
    if (!shelter) return;
    
    // 네이버 지도 SDK 로딩 대기
    const initMap = () => {
      if (!window.naver || !window.naver.maps) {
        console.warn('네이버 지도 SDK가 아직 로드되지 않음, 재시도...');
        return false;
      }
      return true;
    };
    
    const timer = setTimeout(() => {
      if (!initMap()) return;
      initDetailMap();
    }, 500);

    // 상세 화면용 지도 초기화
    const initDetailMap = () => {
      const mapContainer = document.getElementById('detail-map');
      if (!mapContainer || detailMapInstance.current) return;

      try {
        // 대피소 위치를 중심으로 지도 생성
        const mapOptions = {
          center: new window.naver.maps.LatLng(shelter.latitude || 36.0645, shelter.longitude || 129.3775),
          zoom: 16,
          mapTypeControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: window.naver.maps.Position.TOP_RIGHT,
            style: window.naver.maps.ZoomControlStyle.SMALL
          },
          logoControl: false, // 네이버 로고 숨기기
          logoControlOptions: {
            position: window.naver.maps.Position.BOTTOM_LEFT
          },
          scaleControl: false, // 스케일 컨트롤 숨기기
          mapDataControl: false, // 지도 데이터 출처 표시 숨기기
          minZoom: 10,
          maxZoom: 21,
          draggable: true,
          pinchZoom: true,
          scrollWheel: true,
          keyboardShortcuts: false,
          disableDoubleClickZoom: false,
          disableKineticPan: false,
          tileTransition: true
        };

        detailMapInstance.current = new window.naver.maps.Map(mapContainer, mapOptions);

        // 대피소 마커 추가
        const shelterMarker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(shelter.latitude || 36.0645, shelter.longitude || 129.3775),
          map: detailMapInstance.current,
          title: shelter.name,
          icon: {
            content: `
              <div style="
                width: 40px;
                height: 40px;
                background: #0d6efd;
                border-radius: 50%;
                border: 3px solid #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ">
                🏢
              </div>
            `,
            anchor: new window.naver.maps.Point(20, 20)
          }
        });

        console.log('✅ 상세 화면 지도 초기화 완료:', shelter.name);
      } catch (error) {
        console.warn('⚠️ 상세 화면 지도 초기화 실패 (무시됨):', error);
      }
    };

    // 지도 SDK 로딩 대기
    if (window.naver && window.naver.maps) {
      initDetailMap();
    } else {
      const checkNaverMaps = setInterval(() => {
        if (window.naver && window.naver.maps) {
          clearInterval(checkNaverMaps);
          initDetailMap();
        }
      }, 100);

      return () => clearInterval(checkNaverMaps);
    }

    // 컴포넌트 언마운트 시 지도 정리
    return () => {
      clearTimeout(timer);
      if (detailMapInstance.current) {
        console.log('🗑️ 상세 화면 지도 정리');
        detailMapInstance.current = null;
      }
    };
  }, [shelter]);

  if (!shelter) return null;

  return (
    <div className="shelter-detail-view">
      {/* 상단 헤더 */}
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ←
        </button>
        <div className="header-content">
          <div className="alert-badge">
            ⚠️ 경상북도 의성군 의성읍 화재
          </div>
          <div className="user-profile">
            <div className="profile-avatar">👤</div>
          </div>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="detail-map-section">
        <div className="detail-map-container" id="detail-map">
          {/* 실제 지도가 여기에 렌더링됩니다 */}
          <div className="map-overlay-info">
            <div className="time-badge warning">
              ⚠️ 1단계
            </div>
            <div className="fire-risk">
              🔥 85%
            </div>
          </div>
          
          {/* 범례 */}
          <div className="map-legend">
            <div className="legend-item warning">
              <span className="legend-color warning"></span>
              <span>warning</span>
            </div>
            <div className="legend-item caution">
              <span className="legend-color caution"></span>
              <span>caution</span>
            </div>
          </div>
        </div>
      </div>

      {/* 대피소 상세 정보 */}
      <div className="detail-content">
        {/* 대피소 이미지 */}
        <div className="shelter-image">
          <img 
            src={shelter.imageUrl || "/images/3.png"}
            alt={shelter.name}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="image-fallback">
            <span className="building-icon">🏢</span>
          </div>
        </div>

        {/* 대피소 정보 */}
        <div className="shelter-info">
          <h1 className="shelter-name">{shelter.name}</h1>
          <div className="shelter-subtitle">지하 1층</div>
          
          <div className="shelter-description">
            지진해일 간단대피장소
          </div>

          <div className="shelter-address">
            <span className="location-icon">📍</span>
            <span>{shelter.address || '경북 영덕군 강구면 선귀리1길 45-5'}</span>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="detail-actions">
          <button className="guidance-button" onClick={onStartGuidance}>
            대피소 안내 시작
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShelterDetailView;
