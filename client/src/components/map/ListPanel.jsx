import React, { forwardRef, useState, useRef, useEffect } from 'react';
import './ListPanel.css';

const ListPanel = forwardRef(({
  isVisible,
  selectedCategory,
  listPanelData,
  isLoading,
  error,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onRouteClick,
  onTogglePanel,
  isPanelExpanded,
  onShelterClick, // 대피소 클릭 시 지도 이동을 위한 콜백
  onSelectShelter // Select 버튼 클릭 시 상세 화면 전환을 위한 콜백
}, ref) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const cardsContainerRef = useRef(null);

  // 스크롤 위치에 따라 현재 카드 인덱스 업데이트
  const handleScroll = () => {
    if (!cardsContainerRef.current) return;
    
    const container = cardsContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.clientWidth; // 각 카드가 전체 너비를 차지
    const newIndex = Math.round(scrollLeft / cardWidth);
    
    if (newIndex !== currentCardIndex && newIndex >= 0 && newIndex < listPanelData.length) {
      setCurrentCardIndex(newIndex);
      console.log('📋 현재 카드 변경:', newIndex, listPanelData[newIndex]?.name);
    }
  };

  // 데이터 변경 시 첫 번째 카드로 리셋
  useEffect(() => {
    setCurrentCardIndex(0);
  }, [listPanelData]);

  if (!isVisible) return null;

  return (
    <div
      ref={ref}
      className={`list-panel ${isPanelExpanded ? 'expanded' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 드래그 핸들 */}
      <div 
        className={`drag-handle ${isPanelExpanded ? 'expanded' : ''}`}
        onClick={(e) => {
          console.log('드래그 핸들 클릭됨!', { isPanelExpanded, onTogglePanel });
          e.stopPropagation();
          onTogglePanel();
        }}
        title={isPanelExpanded ? "패널 접기" : "패널 펼치기"}
      >
        <div className="drag-bar"></div>
      </div>
      
      {/* 패널 헤더 - 새로운 디자인 */}
      <div className="modern-panel-header">
        <div className="header-icon">
          <span className="shelter-emoji">🏠</span>
        </div>
        <h2 className="header-title">Shelter Location</h2>
      </div>

      {/* 패널 내용 - 새로운 디자인 */}
      <div className="modern-panel-content">
        {isLoading ? (
          <div className="loading-indicator">
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🏢</div>
              <div>포항시 공공데이터에서 대피소 정보를 불러오는 중...</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                잠시만 기다려주세요
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="error-message">
            <div style={{ textAlign: 'center', padding: '20px', color: '#d32f2f' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🚫</div>
              <div style={{ fontWeight: '600' }}>포항시 대피소 데이터 로딩 실패</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                {error}
              </div>
              <div style={{ fontSize: '11px', marginTop: '8px', color: '#999' }}>
                네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요
              </div>
            </div>
          </div>
        ) : listPanelData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>📋</div>
            <div>표시할 데이터가 없습니다</div>
          </div>
        ) : (
          <>
            {/* 탭 헤더 */}
            <div className="section-tabs">
              <div className="tab active">Recommendation</div>
            </div>
            
            {/* 대피소 카드 컨테이너 - 드래그 가능한 스크롤 */}
            <div 
              ref={cardsContainerRef}
              className="shelter-cards-scrollable"
              onScroll={handleScroll}
            >
              {listPanelData.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`image-shelter-card-single ${idx === currentCardIndex ? 'active' : ''}`}
                  onClick={() => onShelterClick && onShelterClick(item)}
                >
                  {/* 카드 이미지 */}
                  <div className="card-image">
                    <img 
                      src={item.imageUrl || "/images/3.png"}
                      alt={item.name}
                      className="shelter-card-image"
                      onError={(e) => {
                        // 이미지 로딩 실패 시 플레이스홀더로 대체
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="image-placeholder" style={{ display: 'none' }}>
                      <span className="building-icon">🏢</span>
                    </div>
                  </div>
                  
                  {/* 카드 정보 오버레이 */}
                  <div className="card-overlay">
                    <h4 className="card-title">{item.name}</h4>
                    <div className="card-details">
                      <span className="detail-item">
                        <span className="icon">🚶</span> {item.distance}
                      </span>
                      <span className="detail-item">
                        <span className="icon">🚗</span> {Math.round(parseFloat(item.distance.replace(/[^\d.]/g, '')) / 50) || 5}min
                      </span>
                      <span className="detail-item">
                        <span className="icon">📏</span> {item.area}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 하단 안내 시작 버튼 */}
            <div className="guide-button-container">
              <button 
                className="guide-start-button"
                onClick={() => {
                  // 현재 스크롤 위치에 있는 대피소를 선택
                  const currentShelter = listPanelData[currentCardIndex];
                  if (currentShelter && onSelectShelter) {
                    console.log('🎯 Select 버튼 클릭 - 선택된 대피소:', currentShelter.name, '인덱스:', currentCardIndex);
                    onSelectShelter(currentShelter);
                  } else {
                    console.warn('⚠️ 선택할 대피소가 없습니다');
                  }
                }}
              >
                Select
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default ListPanel;