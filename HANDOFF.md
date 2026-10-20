# 인수인계 문서 (AI A → AI B)

## 1. 목표
팬카드 스튜디오(React + Vite)에서 **템플릿이 새로고침 후에도 남게** 한다. 대상은 탭 "4. 실제 템플릿 관리"와 탭 "5. 옮겨 쓰기와 완성본" 둘 다.
원인: 두 탭이 `window.storage`(Claude 아티팩트 전용 API)에 기대는데, 일반 브라우저(Vercel)에는 없어서 저장이 실패하고 새로고침하면 사라진다.

## 2. 현재 상태
- 작업 시작 기준 코드 버전 ID: `fcc33303091c8c484d0cf1a7c1af2482e953df4f` (태그 `a-stop`). 이 커밋 뒤에 추가된 것은 문서 파일(HANDOFF.md, checks/RECORD.md)뿐이었다.
- 시작 소스: `04088c2`(받은 그대로), 검사 고정: `5234596`.
- 구현: `src/storage.js`는 `window.storage`가 있으면 사용하고, 없으면 `localStorage`로 대체한다. 탭 4와 탭 5 모두 이 어댑터를 사용한다.
- 검사 10개: 수정 전 6/10 → AI A 종료 시 10/10 → 현재도 10/10 (고정 검사는 탭 4만 대상).
- 탭 5에서 직접 저장한 템플릿과 JSON으로 가져온 템플릿 모두 새로고침 후 유지됨을 브라우저로 확인했다.

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
- 남은 문제 없음.
- 탭 5의 직접 저장과 JSON 가져오기는 `persistTemplates`를 통해 같은 어댑터에 저장되며, 두 경로 모두 새로고침 후 남는 것을 확인했다.
- 고정 검사는 탭 4만 본다. 탭 5 확인은 별도 브라우저 검증으로 수행했다(검사 추가 없음).

## 6. 다음 행동 (완료)
- `src/cards/Card5.jsx`에 저장 어댑터를 연결했다. JSON 가져오기도 같은 저장 함수를 이용하므로 가져온 템플릿도 영구 저장된다.
- `npm run build` 성공, 고정 검사 T01~T10 변경 없이 `PASS 10/10` (`checks/last-result.json`).
- 탭 5의 저장 및 JSON 가져오기 경로를 각각 새로고침해 유지되는 것을 확인했다.
- 대조 시 확인된 누락: 탭 5의 저장 어댑터 연결. 위와 같이 수정 및 검증 완료.

## 7. 건드리지 말 것
- `checks/SPEC.md`, `checks/run.cjs`의 검사 10개: 삭제·완화·기대값 변경 금지.
- `checks/baseline-result.json`, `checks/after-A-result.json`: 기록 보존.
- 탭 1~3의 동작, 템플릿 저장 키 이름(`photo-editor-templates`), 템플릿 데이터 모양.
- `src/storage.js`의 get/set 호출 모양(탭 4가 의존).
