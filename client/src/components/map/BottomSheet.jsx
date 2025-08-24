import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function BottomSheet({
  initialSnap = 1,               // 0: 펼침, 1: 중간, 2: 접힘
  snapPoints,                    // px 값 배열 (예: [height*0.15, height*0.45, height*0.75] 처럼 translateY 값)
  header, children, onSnapChange,
}) {
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  const defaultSnaps = useMemo(() => snapPoints || [H * 0.65, H * 0.35, 64], [H, snapPoints]);
  const maxY = defaultSnaps[0];               // 가장 접힌 상태의 Y 오프셋
  const [y, setY] = useState(defaultSnaps[initialSnap] ?? defaultSnaps[1]);
  const startYRef = useRef(0);
  const baseRef = useRef(0);
  const draggingRef = useRef(false);

  const setToSnap = (idx) => {
    const ny = defaultSnaps[idx] ?? defaultSnaps[1];
    setY(ny);
    onSnapChange && onSnapChange(idx);
  };

  const onStart = (clientY) => {
    draggingRef.current = true;
    startYRef.current = clientY;
    baseRef.current = y;
  };
  const onMove = (clientY) => {
    if (!draggingRef.current) return;
    const dy = clientY - startYRef.current;
    const ny = Math.min(Math.max(baseRef.current + dy, 0), maxY);
    setY(ny);
  };
  const onEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    // 가장 가까운 스냅으로
    const idx = defaultSnaps.reduce((best, cur, i) =>
      Math.abs(y - cur) < Math.abs(y - defaultSnaps[best]) ? i : best, 0);
    setToSnap(idx);
  };

  // 이벤트 바인딩
  useEffect(() => {
    const mm = (e) => onMove(e.clientY);
    const mu = () => onEnd();
    const tm = (e) => onMove(e.touches[0].clientY);
    const tu = () => onEnd();
    window.addEventListener('mousemove', mm, { passive: true });
    window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend', tu);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', tu);
    };
  }, [y, defaultSnaps]);

  return (
    <div
      className="bsheet"
      style={{ transform: `translateY(${y}px)` }}
      aria-hidden="false"
    >
      <div
        className="bsheet-grabber"
        onMouseDown={(e) => onStart(e.clientY)}
        onTouchStart={(e) => onStart(e.touches[0].clientY)}
        role="button"
        aria-label="drag handle"
      >
        <span className="grabber-bar" />
      </div>
      {header && <div className="bsheet-header">{header}</div>}
      <div className="bsheet-body">{children}</div>
    </div>
  );
}
