# 환경변수 설정 가이드

## 1. .env 파일 생성

서버 디렉토리(`/server`)에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# 포항시 대피 장소 API 키 (디코딩키/평문키)
POHANG_API_KEY=tM2CcqNLmOh1H/mJrtUz+Q/v20hppCEEet5Xc1OqN3V+5tn90SEVQ8GqGRdhp5Slcq/4xEUF8AmXoBBIP75gdg==

# 서버 포트
PORT=4000

# 개발 환경 설정
NODE_ENV=development
```

## 2. API 키 설정

- `POHANG_API_KEY`: 포항시 대피 장소 목록 API의 디코딩된 서비스키 (평문키)
- **API 엔드포인트**: `https://apis.data.go.kr/5020000/pohangShuntPlaceList`
- **공공데이터포털 링크**: https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=5020000
- **중요**: 디코딩된 키(평문키)를 그대로 사용 - 추가 인코딩 없음
- **serviceKey 이중 인코딩 방지**: URLSearchParams를 사용하여 올바른 인코딩 처리

## 3. 보안 주의사항

- `.env` 파일은 절대 Git에 커밋하지 마세요
- API 키는 외부에 노출되지 않도록 주의하세요
- 프로덕션 환경에서는 서버 환경변수로 설정하세요

## 4. 사용법

서버 시작 시 자동으로 환경변수가 로드됩니다:

```bash
cd server
npm start
```

환경변수가 올바르게 설정되지 않으면 API 호출이 실패하고 에러 메시지가 표시됩니다.
