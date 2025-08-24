# 클라이언트 설정 가이드

## 환경 변수 설정

이 애플리케이션을 실행하려면 다음 환경 변수를 설정해야 합니다:

### 1. 네이버 지도 API 키 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음을 추가하세요:

```bash
# Naver Maps SDK Client ID
REACT_APP_NCP_CLIENT_ID=your_naver_maps_client_id_here

# API Base URL (개발 환경)
REACT_APP_API_BASE=http://localhost:4000/
```

#### 네이버 지도 API 키 얻는 방법:
1. [Naver Cloud Platform](https://www.ncloud.com/)에 가입
2. Maps 서비스 활성화
3. Application 등록 후 Client ID 발급
4. 발급받은 Client ID를 `REACT_APP_NCP_CLIENT_ID`에 설정

### 2. 서버 연결 설정

백엔드 서버가 실행 중인 경우:
```bash
REACT_APP_API_BASE=http://localhost:4000/
```

백엔드 서버가 없는 경우:
```bash
REACT_APP_API_BASE=
```
(빈 값으로 설정하면 더미 데이터를 사용합니다)

## 실행 방법

1. 환경 변수 설정 후:
```bash
npm install
npm start
```

2. 브라우저에서 `http://localhost:3000` 접속

## 문제 해결

### 지도가 로드되지 않는 경우
- `REACT_APP_NCP_CLIENT_ID`가 올바르게 설정되었는지 확인
- 네이버 클라우드 플랫폼에서 Maps 서비스가 활성화되었는지 확인

### 대피소 데이터가 표시되지 않는 경우
- `REACT_APP_API_BASE`가 올바르게 설정되었는지 확인
- 백엔드 서버가 실행 중인지 확인
- API 키가 설정되지 않은 경우 더미 데이터가 자동으로 표시됩니다

### 하단 패널이 작동하지 않는 경우
- 브라우저 콘솔에서 오류 메시지 확인
- 터치 이벤트가 지원되는 디바이스에서 테스트
- 모바일 브라우저에서 테스트 권장

## 기능

- ✅ 하단 패널 드래그로 높이 조절 (180px ~ 400px)
- ✅ 터치 기반 패널 확장/축소
- ✅ 대피소 정보 표시
- ✅ 길찾기 기능
- ✅ 현재 위치 추적
- ✅ 네이버 지도 연동
- ✅ API 연결 실패 시 더미 데이터 사용
