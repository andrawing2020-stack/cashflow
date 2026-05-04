# 현금흐름 캘린더

개인용 현금흐름 관리 앱. 달력에서 수입/지출을 한눈에 확인.

## 배포 방법

### 1. GitHub에 올리기
```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cashflow-calendar.git
git push -u origin main
```

### 2. Vercel 연결
1. [vercel.com](https://vercel.com) 접속 → GitHub 로그인
2. "Add New Project" → `cashflow-calendar` 레포 선택
3. Framework Preset: **Vite** 선택
4. "Deploy" 클릭
5. 배포 완료되면 `https://cashflow-calendar.vercel.app` 같은 주소 생성

### 3. 폰에서 앱처럼 쓰기
- **iPhone**: Safari에서 접속 → 공유 버튼 → "홈 화면에 추가"
- **Android**: Chrome에서 접속 → 메뉴 → "홈 화면에 추가"

## 로컬 개발
```bash
npm install
npm run dev
```
