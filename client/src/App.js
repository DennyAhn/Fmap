import React from 'react';
import './index.css';
import MapContainer from './components/map/MapContainer';

// 고정 시작 위치 (실시간 위치 추적 비활성화)
const FIXED_LOCATION = { lat: 36.0805, lng: 129.4040 };

export default function App() {
  return (
    <div style={{ height: '100%' }}>
      <MapContainer
        startLocation={FIXED_LOCATION}
        onEditDestination={() => {}}
      />
    </div>
  );
}
