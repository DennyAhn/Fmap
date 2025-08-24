// server/app.js
// ★ 최우선으로 dotenv 로드
require('dotenv').config();

// 환경변수 로드 확인
console.log('🔧 환경변수 확인:', {
  POHANG_API_KEY_EXISTS: !!process.env.POHANG_API_KEY,
  POHANG_API_KEY_LENGTH: process.env.POHANG_API_KEY?.length,
  TMAP_API_KEY_EXISTS: !!process.env.TMAP_API_KEY,
  TMAP_API_KEY_LENGTH: process.env.TMAP_API_KEY?.length,
  PORT: process.env.PORT
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ★ 반드시 라우터보다 먼저 미들웨어 설정
app.use(helmet());
app.use(cors());
app.use(express.json());       // ← JSON body 파싱 (필수)
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ★ 라우터 등록 (환경변수 로드 후)
app.use('/api/directions', require('./routes/directions'));
app.use('/api/hazards', require('./routes/hazards'));
app.use('/api/shelters', require('./routes/shelters'));
app.use('/api/naver', require('./routes/navermap'));

// 헬스체크 엔드포인트
app.get('/healthz', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log('📋 Available endpoints:');
  console.log('  - GET  /healthz');
  console.log('  - POST /api/directions/walk');
  console.log('  - POST /api/directions/drive');
  console.log('  - GET  /api/shelters/categories');
  console.log('  - GET  /api/shelters/nearby');
  console.log('  - GET  /api/shelters/pohang-shelters');
});
