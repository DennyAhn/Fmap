import React, { useState, useEffect, useRef } from 'react';

/**
 * 산불 번짐 시각화 레이어 컴포넌트
 * NDJSON 프레임 데이터를 받아서 네이버 지도 위에 시간순으로 시각화
 */
const WildfireLayer = ({ map, frames }) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms
  
  // 현재 렌더된 마커들을 추적
  const currentMarkers = useRef([]);
  const playInterval = useRef(null);

  // 현재 프레임 데이터
  const currentFrame = frames[currentFrameIndex] || null;

  // 기존 마커들 제거
  const clearMarkers = () => {
    currentMarkers.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    currentMarkers.current = [];
  };

  // 프레임 렌더링 (마커 기반)
  const renderFrame = (frame) => {
    if (!map || !frame) {
      console.warn('⚠️ [WildfireLayer] 지도 또는 프레임이 없음:', { map: !!map, frame: !!frame });
      return;
    }

    console.log(`🔥 [WildfireLayer] 프레임 렌더링: ${frame.t}분, ${frame.burned.length}개 셀`);

    // 기존 마커 제거
    clearMarkers();

    // 각 burned 좌표에 대해 화재 마커 생성
    frame.burned.forEach((coord, index) => {
      try {
        if (!coord.lat || !coord.lon) {
          console.warn(`⚠️ [WildfireLayer] 잘못된 좌표: `, coord);
          return;
        }

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

        currentMarkers.current.push(marker);
        
        console.log(`🔥 [WildfireLayer] 마커 생성: (${coord.lat}, ${coord.lon})`);
        
      } catch (error) {
        console.error(`❌ [WildfireLayer] 마커 생성 실패 (${coord.lat}, ${coord.lon}):`, error);
      }
    });

    console.log(`✅ [WildfireLayer] ${currentMarkers.current.length}개 마커 렌더링 완료`);
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    console.log('🔥 [WildfireLayer] 컴포넌트 마운트됨:', {
      map: !!map,
      framesCount: frames.length,
      firstFrame: frames[0]
    });
    
    // 즉시 첫 번째 프레임 렌더링
    if (map && frames.length > 0) {
      console.log('🔥 [WildfireLayer] 즉시 첫 번째 프레임 렌더링 시도');
      renderFrame(frames[0]);
    }

    return () => {
      clearMarkers();
    };
  }, [map, frames]);

  // 프레임 변경 시 렌더링
  useEffect(() => {
    if (currentFrame) {
      renderFrame(currentFrame);
    }
  }, [currentFrameIndex, currentFrame]);

  // 자동 재생 로직
  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      playInterval.current = setInterval(() => {
        setCurrentFrameIndex(prev => {
          const next = prev + 1;
          if (next >= frames.length) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, playSpeed);
    } else {
      if (playInterval.current) {
        clearInterval(playInterval.current);
        playInterval.current = null;
      }
    }

    return () => {
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    };
  }, [isPlaying, playSpeed, frames.length]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearMarkers();
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    };
  }, []);

  // 슬라이더 핸들러
  const handleSliderChange = (event) => {
    const newIndex = parseInt(event.target.value);
    setCurrentFrameIndex(newIndex);
    setIsPlaying(false);
  };

  // 재생/일시정지 토글
  const togglePlay = () => {
    if (currentFrameIndex >= frames.length - 1) {
      setCurrentFrameIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  // 이전/다음 프레임
  const goToPrevFrame = () => {
    setCurrentFrameIndex(Math.max(0, currentFrameIndex - 1));
    setIsPlaying(false);
  };

  const goToNextFrame = () => {
    setCurrentFrameIndex(Math.min(frames.length - 1, currentFrameIndex + 1));
    setIsPlaying(false);
  };

  if (!frames.length) {
    return null;
  }

  // 컨트롤 패널을 숨기고 마커만 표시
  return null;
};

export default WildfireLayer;