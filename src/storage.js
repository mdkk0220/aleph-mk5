// 템플릿 영구 저장소.
// - Claude 아티팩트 환경처럼 window.storage가 있으면 그것을 쓴다.
// - 일반 브라우저(Vercel 배포 등)에는 window.storage가 없으므로 localStorage로 대신한다.
// 두 경우 모두 get(key) / set(key, value) 모양이 같다.
const localAdapter = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value === null ? null : { key, value };
  },
  async set(key, value) {
    // 용량 초과·저장소 차단이면 여기서 예외가 나고, 호출한 쪽이 실패 안내를 보여 준다.
    window.localStorage.setItem(key, value);
    return { key, value };
  },
};

export const storage =
  typeof window !== "undefined" && window.storage ? window.storage : localAdapter;
