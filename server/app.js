// server/app.js
require('dotenv').config();

// 환경변수 로드 확인
console.log('🔧 환경변수 확인:', {
  POHANG_API_KEY_EXISTS: !!process.env.POHANG_API_KEY,
  POHANG_API_KEY_LENGTH: process.env.POHANG_API_KEY?.length,
  PORT: process.env.PORT
});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const app = express();
app.use('/api/hazards', require('./routes/hazards'));
app.use('/api/shelters', require('./routes/shelters'));
app.use('/api/naver', require('./routes/navermap'));
app.use('/api/directions', require('./routes/directions'));
const hazards = require('./routes/hazards');


app.use(helmet());
app.use(cors());
app.use(express.json());       // ← ★ JSON body 파싱 (필수)
app.use(morgan('dev'));

app.use('/api/hazards', hazards);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server http://localhost:${port}`));
