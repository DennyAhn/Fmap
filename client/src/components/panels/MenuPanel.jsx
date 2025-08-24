import React from 'react';

export default function MenuPanel({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position:'absolute', left:0, top:0, bottom:0, width:260, background:'#fff',
      borderRight:'1px solid #eee', zIndex:1200, padding:12
    }}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <strong>메뉴</strong><button onClick={onClose}>닫기</button>
      </div>
      <div style={{color:'#666',fontSize:13}}>메뉴 내용을 추가하세요.</div>
    </div>
  );
}
