import { useState, useRef, useEffect, useMemo } from "react";
import { Image as ImageIcon, Type, AlertCircle, Upload, Download } from "lucide-react";

const ACCEPTED = ["image/png", "image/jpeg"];
const RATIOS = [
  { id: "1:1", label: "1:1", w: 1080, h: 1080 },
  { id: "4:5", label: "4:5", w: 1080, h: 1350 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
];
const FONT_STACK =
  "Pretendard, -apple-system, 'Noto Sans KR', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const MIN_FONT_FRAC = 0.018; // 이 이하로는 더 줄이지 않고 잘림을 허용하는 최후 방어선

function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];
  for (const para of paragraphs) {
    if (para === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const ch of para) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// 문구·이미지 도구 공통 레이아웃 계산: 미리보기와 저장 파일이 항상 같은 결과를 내도록
// 픽셀 단위(stageW/H)로 계산하고, 영역을 넘치면 폰트를 줄여 재계산한다. (T03-C16, 잘림 방지)
function computeLayout(ctx, { text, desiredFrac, stageW, stageH }) {
  let frac = desiredFrac;
  const maxWidth = stageW * 0.9;
  const maxHeight = stageH * 0.85;
  let fontPx, lineHeightPx, lines;

  while (true) {
    fontPx = frac * stageW;
    ctx.font = `700 ${fontPx}px ${FONT_STACK}`;
    lines = text === "" ? [] : wrapText(ctx, text, maxWidth);
    lineHeightPx = fontPx * 1.3;
    const totalHeight = lines.length * lineHeightPx;
    if (totalHeight <= maxHeight || frac <= MIN_FONT_FRAC) break;
    frac *= 0.9;
  }
  return { lines, fontPx, lineHeightPx, frac };
}

function coverCrop(imgW, imgH, targetW, targetH) {
  const imgRatio = imgW / imgH;
  const targetRatio = targetW / targetH;
  if (imgRatio > targetRatio) {
    const sHeight = imgH;
    const sWidth = imgH * targetRatio;
    return { sx: (imgW - sWidth) / 2, sy: 0, sWidth, sHeight };
  }
  const sWidth = imgW;
  const sHeight = imgW / targetRatio;
  return { sx: 0, sy: (imgH - sHeight) / 2, sWidth, sHeight };
}

export default function EditPreviewCard3() {
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("여기에 문구를 입력하세요");
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(80);
  const [fontSizeCqw, setFontSizeCqw] = useState(7);
  const [color, setColor] = useState("#ffffff");
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [exportUrl, setExportUrl] = useState(null);
  const [exportedFor, setExportedFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const inputRef = useRef(null);
  const stageRef = useRef(null);
  const draggingRef = useRef(false);
  const measureCanvasRef = useRef(null);
  if (!measureCanvasRef.current) {
    measureCanvasRef.current = document.createElement("canvas");
  }

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const ctx = measureCanvasRef.current.getContext("2d");
    if (!stageSize.w || !stageSize.h) return { lines: [], fontPx: 0, lineHeightPx: 0, frac: fontSizeCqw / 100 };
    return computeLayout(ctx, {
      text,
      desiredFrac: fontSizeCqw / 100,
      stageW: stageSize.w,
      stageH: stageSize.h,
    });
  }, [text, fontSizeCqw, stageSize]);

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      // 잘못된 극단 입력이 들어와도 기존 편집 내용은 그대로 유지한다. (T03-C16)
      setError(`지원하지 않는 파일 형식이에요 (${file.type || "알 수 없음"}). PNG 또는 JPEG 파일만 올릴 수 있어요.`);
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    const el = new window.Image();
    el.onload = () => setImage({ url, name: file.name, el });
    el.src = url;
    setExportUrl(null);
    setExportedFor(null);
  };

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };
  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const onTextPointerDown = () => (draggingRef.current = true);
  const onStagePointerMove = (e) => {
    if (!draggingRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setPosX(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    setPosY(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
  };
  const onStagePointerUp = () => (draggingRef.current = false);

  const selectRatio = (r) => {
    setRatio(r);
    setExportUrl(null);
    setExportedFor(null);
  };

  const generateExport = async () => {
    if (!image) return;
    setBusy(true);
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    const targetW = ratio.w;
    const targetH = ratio.h;
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    // 배경을 미리 채우지 않아 투명 PNG의 알파 채널이 그대로 보존된다. (T03-C14, 투명 이미지)

    const { sx, sy, sWidth, sHeight } = coverCrop(image.el.naturalWidth, image.el.naturalHeight, targetW, targetH);
    ctx.drawImage(image.el, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

    const exportLayout = computeLayout(ctx, {
      text,
      desiredFrac: fontSizeCqw / 100,
      stageW: targetW,
      stageH: targetH,
    });

    if (exportLayout.lines.length > 0) {
      ctx.font = `700 ${exportLayout.fontPx}px ${FONT_STACK}`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = exportLayout.fontPx * 0.12;

      const totalHeight = exportLayout.lines.length * exportLayout.lineHeightPx;
      const cx = (posX / 100) * targetW;
      const cy = (posY / 100) * targetH;
      const startY = cy - totalHeight / 2 + exportLayout.lineHeightPx / 2;
      exportLayout.lines.forEach((line, i) => {
        ctx.fillText(line, cx, startY + i * exportLayout.lineHeightPx);
      });
    }

    setExportUrl(canvas.toDataURL("image/png"));
    setExportedFor(ratio.id);
    setBusy(false);
  };

  const downloadExport = () => {
    if (!exportUrl) return;
    const a = document.createElement("a");
    a.href = exportUrl;
    a.download = `preview-${ratio.id.replace(":", "x")}.png`;
    a.click();
  };

  const shrunk = layout.frac < fontSizeCqw / 100 - 0.0001;

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#141311",
        color: "#EDE8DF",
        fontFamily: FONT_STACK,
        padding: "28px 20px 44px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.4, color: "#8A8377", marginBottom: 6 }}>카드 3</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>극단 입력 12건</h1>
          <p style={{ color: "#B4AEA1", fontSize: 14, marginTop: 6 }}>
            아주 긴 문구, 이모지, 빈 문구, 세로·가로·투명 이미지에서도 편집 내용이 잘리거나 사라지지 않는지 확인합니다.
          </p>
        </div>

        <div style={{ border: "1px solid #322F28", borderRadius: 12, padding: 14, marginBottom: 14, background: "#1B1A17" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ImageIcon size={16} color="#C97B4A" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>이미지 도구</span>
          </div>
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{ border: "1.5px dashed #4A453B", borderRadius: 10, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: "#141311" }}
          >
            <Upload size={18} color="#8A8377" style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 13, color: "#D8D2C5" }}>클릭하거나 파일을 끌어다 놓으세요 (PNG, JPEG만 · 투명/세로/가로 이미지 모두 가능)</div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onInputChange} style={{ display: "none" }} />
          </div>
          {error && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", background: "#2A1B16", border: "1px solid #6B3A28", color: "#E8A98A", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #322F28", borderRadius: 12, padding: 14, marginBottom: 14, background: "#1B1A17" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Type size={16} color="#C97B4A" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>문구 도구</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="긴 문장, 한글+영문 혼합, 이모지, 줄바꿈(Enter)을 자유롭게 테스트해보세요. 비워둘 수도 있어요."
            style={{ width: "100%", boxSizing: "border-box", background: "#141311", border: "1px solid #4A453B", borderRadius: 8, padding: "8px 10px", color: "#EDE8DF", fontSize: 13, marginBottom: 8, resize: "vertical", fontFamily: "inherit" }}
          />
          {shrunk && (
            <div style={{ fontSize: 11, color: "#8FBF9A", marginBottom: 10 }}>
              문구가 영역보다 커서 자동으로 글자 크기를 줄였어요 (설정값 {fontSizeCqw}% → 실제 {(layout.frac * 100).toFixed(1)}%). 잘리지 않게 보정된 결과예요.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>가로 위치 {Math.round(posX)}%</label>
              <input type="range" min={0} max={100} value={posX} onChange={(e) => setPosX(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>세로 위치 {Math.round(posY)}%</label>
              <input type="range" min={0} max={100} value={posY} onChange={(e) => setPosY(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>희망 크기 {fontSizeCqw}%</label>
              <input type="range" min={2} max={20} value={fontSizeCqw} onChange={(e) => setFontSizeCqw(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#8A8377", display: "block", marginBottom: 4 }}>색</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: "100%", height: 32, border: "1px solid #4A453B", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {RATIOS.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRatio(r)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: ratio.id === r.id ? "1.5px solid #C97B4A" : "1px solid #322F28",
                background: ratio.id === r.id ? "#2A1F16" : "#1B1A17",
                color: ratio.id === r.id ? "#F0C7A6" : "#B4AEA1",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "#8A8377", marginBottom: 8 }}>화면 미리보기 ({ratio.label})</div>
            <div
              ref={stageRef}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={onStagePointerUp}
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${ratio.w} / ${ratio.h}`,
                borderRadius: 12,
                overflow: "hidden",
                background:
                  "repeating-conic-gradient(#1c1a17 0% 25%, #141311 0% 50%) 50% / 20px 20px",
                border: "1px solid #322F28",
              }}
            >
              {image ? (
                <img src={image.url} alt={image.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5F594E", fontSize: 13 }}>이미지를 올리면 표시돼요</div>
              )}
              {layout.lines.length > 0 && (
                <div
                  onPointerDown={onTextPointerDown}
                  style={{
                    position: "absolute",
                    left: `${posX}%`,
                    top: `${posY}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: "grab",
                    userSelect: "none",
                    textAlign: "center",
                  }}
                >
                  {layout.lines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: `${layout.fontPx}px`,
                        lineHeight: `${layout.lineHeightPx}px`,
                        fontWeight: 700,
                        color,
                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                        whiteSpace: "pre",
                      }}
                    >
                      {line || "\u00A0"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#8A8377", marginBottom: 8 }}>저장 파일 {exportedFor ? `(${exportedFor})` : ""}</div>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${ratio.w} / ${ratio.h}`,
                borderRadius: 12,
                overflow: "hidden",
                background:
                  "repeating-conic-gradient(#1c1a17 0% 25%, #141311 0% 50%) 50% / 20px 20px",
                border: "1px solid #322F28",
              }}
            >
              {exportUrl && exportedFor === ratio.id ? (
                <img src={exportUrl} alt="저장 파일 미리보기" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5F594E", fontSize: 12, textAlign: "center", padding: 12 }}>
                  '저장 파일 만들기'를 누르면
                  <br />
                  실제 내보내기 결과가 표시돼요
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={generateExport}
            disabled={!image || busy}
            style={{
              flex: 1,
              background: image ? "#C97B4A" : "#3A362F",
              color: image ? "#141311" : "#767065",
              border: "none",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: image ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "만드는 중..." : "저장 파일 만들기"}
          </button>
          <button
            onClick={downloadExport}
            disabled={!exportUrl}
            style={{
              flex: 1,
              background: "transparent",
              color: exportUrl ? "#EDE8DF" : "#5F594E",
              border: "1px solid #4A453B",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: exportUrl ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Download size={15} />
            내려받기
          </button>
        </div>
      </div>
    </div>
  );
}
