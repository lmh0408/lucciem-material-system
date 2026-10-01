# 루시엠(Lucciem) 자재 관리 및 자동 발주 시스템

무선 송출 장비 전문 기업 루시엠의 4대 제품군(야외용, 실내용, 이동식, L-Send) 자재 통합 관리 및 자동 발주 시스템입니다.

## 🚀 로컬 개발 환경 실행 방법 (Cursor / VS Code)

### 1. 패키지 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```
- 브라우저에서 `http://localhost:3000` (또는 터미널에 안내된 포트)로 접속하여 확인합니다.

### 3. 프로덕션 빌드 및 린트 검증
```bash
# TypeScript 타입 검사
npm run lint

# 프로덕션 빌드
npm run build
```

---

## 📂 프로젝트 구조

```text
├── .cursorrules               # Cursor AI를 위한 아키텍처 및 코딩 규칙
├── firebase-applet-config.json # Firebase Firestore 연동 설정
├── src/
│   ├── components/            # 주요 UI 컴포넌트
│   │   ├── Navbar.tsx         # 상단 헤더 및 DB 상태
│   │   ├── MaterialManager.tsx# 70개 품목 마스터 관리 (등록/수정/삭제)
│   │   ├── SupplierOrderManager.tsx # 협력사별 주문서 및 PDF 출력
│   │   ├── AutoOrderSimulator.tsx   # ROP 기반 자동 발주 시뮬레이터
│   │   └── CommonPartsMatrix.tsx    # 4대 기종 간 공용 부품 매트릭스
│   ├── data/
│   │   └── materialsData.ts   # 70개 분리 품목 기본 마스터 데이터
│   ├── lib/
│   │   └── firebase.ts        # Firestore 실시간 CRUD 및 시딩 모듈
│   ├── types/
│   │   └── inventory.ts       # 자재, 협력사, 제품군 타입 정의
│   ├── utils/
│   │   └── pdfExport.ts       # 주문서 PDF 자동 생성 유틸리티
│   ├── App.tsx                # 최상위 메인 애플리케이션
│   └── main.tsx               # 진입점
└── vite.config.ts             # Vite 빌드 설정
```

---

## ☁️ Firebase Firestore 연동 안내
- 프로젝트 루트의 `firebase-applet-config.json`에 클라우드 DB 연결 정보가 완벽히 구성되어 있어, 로컬 Cursor 환경에서도 실시간으로 동일한 Firestore 데이터베이스와 연동되어 데이터가 동기화됩니다.
- 네트워크가 오프라인이거나 연결되지 않을 경우 로컬 스토리지 캐시 및 내장 마스터 데이터를 자동으로 불러와 중단 없이 작동합니다.
