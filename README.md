# 📜 두루마리 (Durumari Book Reader)

<p align="center">
  <img src="public/durumari_intro_screen.png" width="300" alt="두루마리 인트로">
</p>

**두루마리**는 기존 WPF 환경에서 완전히 새롭게 작성된 **Tauri 2 + React 기반의 모던 전자책 데스크톱 리더**입니다.  
EPUB과 TXT(ZIP) 포맷을 지원하며, 깔끔한 UI와 강력한 최적화를 통해 쾌적한 독서 경험을 제공합니다.

---

## ✨ 주요 기능

- **다양한 파일 포맷 지원**
  - **EPUB**: `epub.js` 기반의 paginated rendition 지원, 위치(CFI) 완벽 복원
  - **TXT / ZIP**: Web Worker를 이용한 백그라운드 디코딩 및 압축 해제로 메인 스레드 멈춤 방지
- **극대화된 성능 및 최적화**
  - **스마트 페이징**: 첫 페이지만 우선 계산하여 즉시 화면에 띄우고, 나머지는 유휴 시간(Idle time)에 백그라운드 인덱싱
  - **DOM 최적화**: 화면 DOM에는 현재 보고 있는 텍스트 페이지만 렌더링하여 메모리 절약
- **풍부한 독서 환경 설정**
  - 다양한 무료 웹 폰트(나눔명조, 리디바탕, KoPub, 마루부리 등) 기본 내장
  - 글자 크기, 굵기, 줄 간격, 자간 미세 조정 가능
  - 상하좌우 여백 조정 및 다양한 테마(종이, 다크 모드, 라이트 모드) 지원
- **사용자 데이터 및 보관함 관리**
  - 읽기 위치(Progress), 앱 설정, 책갈피, 최근 읽은 목록(히스토리) 로컬 자동 저장
  - 다중 로컬 폴더 추가 및 자동 도서 스캔
  - 열/방향 정렬(오름차순, 내림차순) 지원
  - (예정) 구글 드라이브(Google Drive) 연동을 통한 클라우드 도서 동기화 지원

## 🛠 기술 스택

- **Frontend**: React 19, TypeScript, Vite
- **Desktop/Backend**: Tauri 2, Rust, WebView2
- **Core Libraries**: `epubjs`, `jszip`, `lucide-react`

## 🚀 설치 및 실행 방법

### 요구 사항
Windows 앱으로 빌드 및 실행하기 위해서는 **Rust**와 **Microsoft C++ Build Tools**가 설치되어 있어야 합니다.

### 개발 환경 실행

```powershell
# 의존성 패키지 설치
npm install

# 브라우저 웹 뷰 전용 개발 서버 실행
npm run dev

# Tauri 데스크톱 앱 개발 모드로 실행
npm run tauri:dev
```

### 빌드 및 배포

```powershell
# 배포용 데스크톱 앱 빌드 (설치 파일 생성)
npm run tauri:build
```
> 빌드된 설치 파일(`.exe`, `.msi`)은 자동으로 복사되어 `dist-tauri/` 폴더에 생성됩니다.

---

## 📝 라이선스

이 프로젝트는 개인 독서용으로 제작되었습니다.
내장된 폰트 파일(`public/fonts/`)은 각각의 오픈소스 및 제작자 배포 라이선스를 따릅니다.
