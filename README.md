# 🚨 대피소 지도 앱

포항시 대피 장소 정보를 지도에 표시하는 React + Node.js 애플리케이션

## 🏗️ 프로젝트 구조

```
hack_/
├── client/          # React 클라이언트 (포트 3000)
├── server/          # Node.js 서버 (포트 4000)
└── icon/           # 아이콘 리소스
```

## 🚀 시작하기

### 1. 환경 설정

**서버 환경변수 설정:**
```bash
cd server
cp ENV_SETUP.md .env.example  # 가이드 참고
# .env 파일 생성 필요 (아래 참조)
```

**필수 환경변수 (server/.env):**
```bash
POHANG_API_KEY=your_decoding_key_here
PORT=4000
NODE_ENV=development
```

### 2. 의존성 설치

**서버:**
```bash
cd server
npm install
```

**클라이언트:**
```bash
cd client
npm install
```

### 3. 실행

**서버 시작:**
```bash
cd server
npm start
```

**클라이언트 시작:**
```bash
cd client
npm start
```

## 🔑 API 키 설정

### 포항시 대피 장소 API
- **공공데이터포털**: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=5020000
- **엔드포인트**: `https://apis.data.go.kr/5020000/pohangShuntPlaceList`
- **중요**: 디코딩된 키(평문키)를 그대로 사용

### 환경변수 파일 생성
```bash
# server/.env 파일 생성
POHANG_API_KEY=발급받은_디코딩_키
PORT=4000
NODE_ENV=development
```

## 🛡️ 보안 주의사항

- ⚠️ **절대로 API 키를 Git에 커밋하지 마세요**
- ✅ `.env` 파일은 `.gitignore`에 포함됨
- ✅ 서버에서만 API 호출 (클라이언트 보안)
- ✅ 환경변수로 민감 정보 관리

## 🌐 주요 기능

- 📍 고정 현재 위치 (포항시 중심)
- 🏠 주변 대피 장소 표시
- 🗺️ 네이버 지도 통합
- 📱 반응형 UI
- 🔄 실시간 API 데이터

## 🔧 기술 스택

**Frontend:**
- React.js
- Naver Maps API
- CSS3

**Backend:**
- Node.js
- Express.js
- Axios
- dotenv

## 📋 API 엔드포인트

- `GET /api/shelters/pohang-shelters` - 포항시 대피 장소 목록

## 🧪 테스트

브라우저 개발자 도구에서:
```javascript
testServerAPI()  // 서버 API 테스트
```

## 📝 참고 문서

- `server/ENV_SETUP.md` - 환경변수 설정 가이드
- `server/TMAP_SETUP.md` - TMAP 관련 설정
- `client/SETUP.md` - 클라이언트 설정 가이드

---

⚠️ **중요**: 프로젝트를 로컬에서 실행하기 전에 반드시 `server/.env` 파일을 생성하고 올바른 API 키를 설정하세요.
