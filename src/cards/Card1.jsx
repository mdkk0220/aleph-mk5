import { useState, useRef } from "react";
import { Image as ImageIcon, Type, AlertCircle, Upload } from "lucide-react";

const ACCEPTED = ["image/png", "image/jpeg"];

export default function EditPreviewCard1() {
  const [image, setImage] = useState(null); // {url, name}
  const [error, setError] = useState("");
  const [text, setText] = useState("여기에 문구를 입력하세요");
  const [posX, setPosX] = useState(50); // %
  const [posY, setPosY] = useState(80); // %
  const [fontSize, setFontSize] = useState(28); // px
  const [color, setColor] = useState("#ffffff");
  const inputRef = useRef(null);
  const stageRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      // 지원하지 않는 파일: 기존 작업(이미지)은 그대로 유지, 거부 이유만 표시
      setError(`지원하지 않는 파일 형식이에요 (${file.type || "알 수 없음"}). PNG 또는 JPEG 파일만 올릴 수 있어요.`);
      return;
    }
    setError("");
    setImage({ url: URL.createObjectURL(file), name: file.name });
  };

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  // 드래그로 문구 위치를 직접 옮길 수 있게
  const draggingRef = useRef(false);
  const onTextPointerDown = () => {
    draggingRef.current = true;
  };
  const onStagePointerMove = (e) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPosX(Math.min(100, Math.max(0, x)));
    setPosY(Math.min(100, Math.max(0, y)));
  };
  const onStagePointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#141311",
        color: "#EDE8DF",
        fontFamily: "'Pretendard', -apple-system, 'Noto Sans KR', sans-serif",
        padding: "28px 20px 40px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.4, color: "#8A8377", marginBottom: 6 }}>
            카드 1
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>편집과 미리보기</h1>
          <p style={{ color: "#B4AEA1", fontSize: 14, marginTop: 6 }}>
            이미지를 불러오고, 문구의 위치·크기·색을 바꿔보세요. 바로 미리보기에 반영됩니다.
          </p>
        </div>

        {/* 이미지 편집 도구 */}
        <div
          style={{
            border: "1px solid #322F28",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
            background: "#1B1A17",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ImageIcon size={16} color="#C97B4A" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>이미지 도구</span>
          </div>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: "1.5px dashed #4A453B",
              borderRadius: 10,
              padding: "16px 12px",
              textAlign: "center",
              cursor: "pointer",
              background: "#141311",
            }}
          >
            <Upload size={18} color="#8A8377" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 13, color: "#D8D2C5" }}>
              클릭하거나 파일을 끌어다 놓으세요 (PNG, JPEG만)
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={onInputChange}
              style={{ display: "none" }}
            />
          </div>
          {error && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "#2A1B16",
                border: "1px solid #6B3A28",
                color: "#E8A98A",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 문구 편집 도구 */}
        <div
          style={{
            border: "1px solid #322F28",
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            background: "#1B1A17",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Type size={16} color="#C97B4A" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>문구 도구</span>
          </div>

          <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>
            문구 내용
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#141311",
              border: "1px solid #4A453B",
              borderRadius: 8,
              padding: "8px 10px",
              color: "#EDE8DF",
              fontSize: 13,
              marginBottom: 14,
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>
                가로 위치 {Math.round(posX)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>
                세로 위치 {Math.round(posY)}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>
                크기 {fontSize}px
              </label>
              <input
                type="range"
                min={12}
                max={72}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>
                색
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #4A453B",
                  borderRadius: 6,
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
            </div>
          </div>
        </div>

        {/* 미리보기 */}
        <div>
          <div style={{ fontSize: 12, color: "#8A8377", marginBottom: 8 }}>미리보기</div>
          <div
            ref={stageRef}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerLeave={onStagePointerUp}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 12,
              overflow: "hidden",
              background: "#0F0E0C",
              border: "1px solid #322F28",
            }}
          >
            {image ? (
              <img
                src={image.url}
                alt={image.name}
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  userSelect: "none",
                }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#5F594E",
                  fontSize: 13,
                }}
              >
                이미지를 올리면 여기에 표시돼요
              </div>
            )}

            <div
              onPointerDown={onTextPointerDown}
              style={{
                position: "absolute",
                left: `${posX}%`,
                top: `${posY}%`,
                transform: "translate(-50%, -50%)",
                fontSize: `${fontSize}px`,
                color,
                fontWeight: 700,
                cursor: "grab",
                userSelect: "none",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                whiteSpace: "pre-wrap",
                textAlign: "center",
                maxWidth: "90%",
              }}
            >
              {text}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#5F594E", marginTop: 6 }}>
            문구를 직접 드래그해서 위치를 옮길 수도 있어요.
          </div>
        </div>
      </div>
    </div>
  );
}
