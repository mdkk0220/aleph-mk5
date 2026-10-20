import { useState } from "react";
import Card1 from "./cards/Card1.jsx";
import Card2 from "./cards/Card2.jsx";
import Card3 from "./cards/Card3.jsx";
import Card4 from "./cards/Card4.jsx";
import Card5 from "./cards/Card5.jsx";

const TABS = [
  { id: 1, label: "1. 편집과 미리보기", Comp: Card1 },
  { id: 2, label: "2. 화면과 파일의 일치", Comp: Card2 },
  { id: 3, label: "3. 극단 입력 12건", Comp: Card3 },
  { id: 4, label: "4. 실제 템플릿 관리", Comp: Card4 },
  { id: 5, label: "5. 옮겨 쓰기와 완성본", Comp: Card5 },
];

export default function App() {
  const [active, setActive] = useState(1);
  const Active = TABS.find((t) => t.id === active).Comp;

  return (
    <div style={{ minHeight: "100vh", background: "#141311" }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          gap: 4,
          overflowX: "auto",
          padding: "10px 12px",
          background: "#0F0E0C",
          borderBottom: "1px solid #322F28",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid " + (active === t.id ? "#C97B4A" : "#322F28"),
              background: active === t.id ? "#2A1F16" : "transparent",
              color: active === t.id ? "#F0C7A6" : "#B4AEA1",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily:
                "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <Active />
    </div>
  );
}
