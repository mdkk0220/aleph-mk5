# 인수인계 문서 (AI A → AI B)

## 1. 목표
팬카드 스튜디오(React + Vite)에서 **템플릿이 새로고침 후에도 남게** 한다. 대상은 탭 "4. 실제 템플릿 관리"와 탭 "5. 옮겨 쓰기와 완성본" 둘 다.
원인: 두 탭이 `window.storage`(Claude 아티팩트 전용 API)에 기대는데, 일반 브라우저(Vercel)에는 없어서 저장이 실패하고 새로고침하면 사라진다.

## 2. 현재 상태
- 코드 버전 ID: `fcc33303091c8c484d0cf1a7c1af2482e953df4f` (태그 `a-stop`). 이 커밋 뒤에 추가된 것은 문서 파일(HANDOFF.md, checks/RECORD.md)뿐이다.
- 시작 소스: `04088c2`(받은 그대로), 검사 고정: `5234596`.
- 한 일: `src/storage.js` 신설(window.storage가 있으면 사용, 없으면 localStorage), `src/cards/Card4.jsx`가 이를 사용하도록 연결.
- 검사 10개: 수정 전 6/10 → 지금 10/10 (대상은 탭 4만).

## 3. 실행 명령 (빈 폴더에서)
필요: Node 18 이상, npm. 환경값 없음.
```
git clone <저장소 주소> aleph && cd aleph      # 또는 압축을 푼 폴더로 이동
npm install
npm run build
npx vite preview --port 4173 &                  # 작업 폴더 = 저장소 루트
NODE_PATH=/opt/npm-tools/node_modules node checks/run.cjs
```
검사 실행기는 Playwright(`playwright` 패키지, Chromium)가 필요하다. 없으면 `npm i -D playwright` 후 `NODE_PATH` 없이 실행한다.
마지막에 `PASS 10/10`이 나오면 정상.

## 4. 통과 검사
T01~T10 전부 통과(탭 4 기준). 명세는 `checks/SPEC.md`, 수정 전 결과는 `checks/baseline-result.json`, A 종료 시점 결과는 `checks/after-A-result.json`.

## 5. 남은 문제
- 탭 5(`src/cards/Card5.jsx`)가 아직 `window.storage.get/set(…, false)`를 직접 쓴다 → 배포본에서 템플릿이 저장되지 않는다. (151행, 165행 부근)
- 탭 5에는 JSON 불러오기 기능이 있어서, 불러온 템플릿도 같은 저장소에 들어간다. 고친 뒤 이 경로도 새로고침 후 남는지 눈으로 확인해야 한다.
- 고정 검사는 탭 4만 본다. 탭 5는 사람이 직접 확인한다(검사 추가 금지, 아래 7번).

## 6. 다음 행동 (첫 번째 한 가지)
`Card5.jsx` 맨 위에 `import { storage } from "../storage.js";`를 넣고, 두 곳의 `window.storage.get(TEMPLATES_KEY, false)` / `window.storage.set(TEMPLATES_KEY, JSON.stringify(next), false)`를 `storage.get(TEMPLATES_KEY)` / `storage.set(TEMPLATES_KEY, JSON.stringify(next))`로 바꾼다. 그다음 3번 명령으로 검사 10개를 다시 돌리고, 탭 5에서 저장 → 새로고침 → 남아 있는지 확인한다.
먼저 이 문서의 내용이 실제 코드와 맞는지 대조하고, 안 맞는 곳은 "누락"으로 기록한다.

## 7. 건드리지 말 것
- `checks/SPEC.md`, `checks/run.cjs`의 검사 10개: 삭제·완화·기대값 변경 금지.
- `checks/baseline-result.json`, `checks/after-A-result.json`: 기록 보존.
- 탭 1~3의 동작, 템플릿 저장 키 이름(`photo-editor-templates`), 템플릿 데이터 모양.
- `src/storage.js`의 get/set 호출 모양(탭 4가 의존).
