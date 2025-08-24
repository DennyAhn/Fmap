# 티맵 API 설정 가이드

## 1. 티맵 API 키 발급

1. [SK오픈API 포털](https://openapi.sk.com/) 접속
2. 회원가입 및 로그인
3. "TMap API" 선택
4. 새 프로젝트 생성
5. API 키 발급 받기

## 2. 환경변수 설정

서버 폴더에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 티맵 API 설정
TMAP_API_KEY=your_actual_tmap_api_key_here

# 서버 설정
PORT=5000
NODE_ENV=development
```

⚠️ **중요**: `your_actual_tmap_api_key_here`를 실제 발급받은 API 키로 교체하세요.

## 3. 서버 실행

```bash
cd server
npm start
```

## 4. API 테스트

### 도보 경로 테스트
```bash
curl -X POST http://localhost:5000/api/directions/walk \
  -H "Content-Type: application/json" \
  -d '{
    "startLat": 36.0645,
    "startLng": 129.3775,
    "endLat": 36.0670,
    "endLng": 129.3800
  }'
```

### 자동차 경로 테스트
```bash
curl -X POST http://localhost:5000/api/directions/drive \
  -H "Content-Type: application/json" \
  -d '{
    "startLat": 36.0645,
    "startLng": 129.3775,
    "endLat": 36.0670,
    "endLng": 129.3800
  }'
```

## 5. 주의사항

- API 키는 절대 공개 저장소에 커밋하지 마세요
- `.env` 파일을 `.gitignore`에 추가하세요
- API 사용량 제한을 확인하세요

## 6. 문제 해결

### API 키 오류
- 환경변수가 올바르게 설정되었는지 확인
- API 키가 유효한지 SK오픈API 포털에서 확인

### CORS 오류
- 서버에서 CORS가 올바르게 설정되어 있는지 확인
- 클라이언트 도메인이 허용 목록에 있는지 확인

### 경로 계산 실패
- 출발지와 도착지 좌표가 유효한지 확인
- 네트워크 연결 상태 확인
