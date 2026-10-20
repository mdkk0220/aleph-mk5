import { useState, useRef, useEffect, useMemo } from "react";
import {
  Image as ImageIcon,
  Type,
  AlertCircle,
  Upload,
  Download,
  Save,
  FolderOpen,
  Pencil,
  Trash2,
  Loader2,
  FileJson,
  CheckCircle2,
} from "lucide-react";

const ACCEPTED = ["image/png", "image/jpeg"];
const RATIOS = [
  { id: "1:1", label: "1:1", w: 1080, h: 1080 },
  { id: "4:5", label: "4:5", w: 1080, h: 1350 },
  { id: "9:16", label: "9:16", w: 1080, h: 1920 },
];
const FONT_STACK =
  "Pretendard, -apple-system, 'Noto Sans KR', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const MIN_FONT_FRAC = 0.018;
const TEMPLATES_KEY = "photo-editor-templates";
const REQUIRED_FIELDS = ["id", "name", "text", "posX", "posY", "fontSizeCqw", "color", "ratioId"];

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

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// JSON 유효성 검사: 문법 오류나 필수 항목 누락이면 이유를 담아 실패를 반환한다.
// 저장은 검증을 모두 통과했을 때만 호출 쪽에서 수행한다. (T03-C22~24)
function validateTemplatesJson(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, reason: "JSON 문법이 올바르지 않아요 (파싱 실패). 파일 내용을 확인해주세요." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "최상위 값이 배열이 아니에요. 템플릿 배열([...]) 형태여야 해요." };
  }
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== "object" || item === null) {
      return { ok: false, reason: `${i + 1}번째 항목이 객체가 아니에요.` };
    }
    const missing = REQUIRED_FIELDS.filter((f) => !(f in item));
    if (missing.length > 0) {
      return { ok: false, reason: `${i + 1}번째 항목에 필수 항목이 없어요: ${missing.join(", ")}` };
    }
    if (typeof item.posX !== "number" || typeof item.posY !== "number" || typeof item.fontSizeCqw !== "number") {
      return { ok: false, reason: `${i + 1}번째 항목의 위치·크기 값이 숫자가 아니에요.` };
    }
    if (!RATIOS.some((r) => r.id === item.ratioId)) {
      return { ok: false, reason: `${i + 1}번째 항목의 ratioId 값(${item.ratioId})이 올바르지 않아요.` };
    }
  }
  return { ok: true, templates: parsed };
}

export default function EditPreviewCard5() {
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

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [toast, setToast] = useState("");
  const [importResult, setImportResult] = useState(null); // {ok, reason?, before, after}

  const inputRef = useRef(null);
  const stageRef = useRef(null);
  const draggingRef = useRef(false);
  const jsonInputRef = useRef(null);
  const measureCanvasRef = useRef(null);
  if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement("canvas");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(TEMPLATES_KEY, false);
        const parsed = res?.value ? JSON.parse(res.value) : [];
        setTemplates(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, []);

  const persistTemplates = async (next) => {
    setTemplates(next);
    try {
      const result = await window.storage.set(TEMPLATES_KEY, JSON.stringify(next), false);
      if (!result) throw new Error("save failed");
      setTemplatesError("");
    } catch (e) {
      setTemplatesError("템플릿 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

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
    return computeLayout(ctx, { text, desiredFrac: fontSizeCqw / 100, stageW: stageSize.w, stageH: stageSize.h });
  }, [text, fontSizeCqw, stageSize]);

  const handleFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
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
    const { sx, sy, sWidth, sHeight } = coverCrop(image.el.naturalWidth, image.el.naturalHeight, targetW, targetH);
    ctx.drawImage(image.el, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
    const exportLayout = computeLayout(ctx, { text, desiredFrac: fontSizeCqw / 100, stageW: targetW, stageH: targetH });
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
      exportLayout.lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * exportLayout.lineHeightPx));
    }
    // canvas.toDataURL로 다시 그린 결과물이라 원본 EXIF(위치정보 포함)는 포함되지 않는다. (T03-C28)
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

  const currentSettings = () => ({ text, posX, posY, fontSizeCqw, color, ratioId: ratio.id });

  const createTemplate = async () => {
    const name = nameDraft.trim() || `템플릿 ${templates.length + 1}`;
    const newTemplate = { id: makeId(), name, ...currentSettings(), createdAt: Date.now() };
    await persistTemplates([...templates, newTemplate]);
    setNameDraft("");
    setSelectedTemplateId(newTemplate.id);
    showToast(`'${name}' 템플릿을 만들었어요.`);
  };

  const loadTemplate = (id) => {
    const t = templates.find((tpl) => tpl.id === id);
    if (!t) return;
    setText(t.text);
    setPosX(t.posX);
    setPosY(t.posY);
    setFontSizeCqw(t.fontSizeCqw);
    setColor(t.color);
    const r = RATIOS.find((r) => r.id === t.ratioId) || RATIOS[0];
    setRatio(r);
    setSelectedTemplateId(id);
    setExportUrl(null);
    setExportedFor(null);
    showToast(`'${t.name}' 템플릿을 불러왔어요.`);
  };

  const updateTemplate = async (id) => {
    const next = templates.map((tpl) => (tpl.id === id ? { ...tpl, ...currentSettings() } : tpl));
    await persistTemplates(next);
    showToast("템플릿을 현재 설정으로 수정했어요.");
  };

  const deleteTemplate = async (id) => {
    const target = templates.find((tpl) => tpl.id === id);
    const next = templates.filter((tpl) => tpl.id !== id);
    await persistTemplates(next);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    showToast(`'${target?.name ?? "템플릿"}'을 삭제했어요.`);
  };

  // ---- JSON 내보내기 / 가져오기 ----
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "templates.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onJsonFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const before = templates.length;
    const rawText = await file.text();
    const result = validateTemplatesJson(rawText);

    if (!result.ok) {
      // 검증 실패: 기존 템플릿에는 절대 손대지 않는다. (T03-C23, C24, 막히는 지점 대응)
      setImportResult({ ok: false, reason: result.reason, before, after: before });
      showToast("가져오기 실패 — 기존 템플릿은 그대로예요.");
      return;
    }

    // 검증을 모두 통과한 뒤에만 저장한다.
    await persistTemplates(result.templates);
    setImportResult({ ok: true, before, after: result.templates.length });
    showToast(`JSON을 불러와 템플릿을 복원했어요 (${before}개 → ${result.templates.length}개).`);
  };

  const shrunk = layout.frac < fontSizeCqw / 100 - 0.0001;

  return (
    <div style={{ minHeight: "100%", background: "#141311", color: "#EDE8DF", fontFamily: FONT_STACK, padding: "28px 20px 44px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.4, color: "#8A8377", marginBottom: 6 }}>카드 5</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>옮겨 쓰기와 완성본</h1>
          <p style={{ color: "#B4AEA1", fontSize: 14, marginTop: 6 }}>
            템플릿을 JSON으로 내보내고 다시 불러와보세요. 손상되거나 필수 항목이 빠진 JSON은 저장 전에 거부되고, 기존 템플릿은 그대로 유지돼요.
          </p>
        </div>

        {/* 이미지 도구 */}
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
            <div style={{ fontSize: 13, color: "#D8D2C5" }}>클릭하거나 파일을 끌어다 놓으세요 (PNG, JPEG만)</div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onInputChange} style={{ display: "none" }} />
          </div>
          {error && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", background: "#2A1B16", border: "1px solid #6B3A28", color: "#E8A98A", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 문구 도구 */}
        <div style={{ border: "1px solid #322F28", borderRadius: 12, padding: 14, marginBottom: 14, background: "#1B1A17" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Type size={16} color="#C97B4A" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>문구 도구</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", background: "#141311", border: "1px solid #4A453B", borderRadius: 8, padding: "8px 10px", color: "#EDE8DF", fontSize: 13, marginBottom: 8, resize: "vertical", fontFamily: "inherit" }}
          />
          {shrunk && <div style={{ fontSize: 11, color: "#8FBF9A", marginBottom: 10 }}>문구가 영역보다 커서 자동으로 글자 크기를 줄였어요.</div>}
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: "#8A8377", marginBottom: 8 }}>화면 미리보기 ({ratio.label})</div>
            <div
              ref={stageRef}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={onStagePointerUp}
              style={{ position: "relative", width: "100%", aspectRatio: `${ratio.w} / ${ratio.h}`, borderRadius: 12, overflow: "hidden", background: "#0F0E0C", border: "1px solid #322F28" }}
            >
              {image ? (
                <img src={image.url} alt={image.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5F594E", fontSize: 13 }}>이미지를 올리면 표시돼요</div>
              )}
              {layout.lines.length > 0 && (
                <div onPointerDown={onTextPointerDown} style={{ position: "absolute", left: `${posX}%`, top: `${posY}%`, transform: "translate(-50%, -50%)", cursor: "grab", userSelect: "none", textAlign: "center" }}>
                  {layout.lines.map((line, i) => (
                    <div key={i} style={{ fontSize: `${layout.fontPx}px`, lineHeight: `${layout.lineHeightPx}px`, fontWeight: 700, color, textShadow: "0 1px 3px rgba(0,0,0,0.6)", whiteSpace: "pre" }}>
                      {line || "\u00A0"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#8A8377", marginBottom: 8 }}>저장 파일 {exportedFor ? `(${exportedFor})` : ""}</div>
            <div style={{ position: "relative", width: "100%", aspectRatio: `${ratio.w} / ${ratio.h}`, borderRadius: 12, overflow: "hidden", background: "#0F0E0C", border: "1px solid #322F28" }}>
              {exportUrl && exportedFor === ratio.id ? (
                <img src={exportUrl} alt="저장 파일 미리보기" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5F594E", fontSize: 12, textAlign: "center", padding: 12 }}>
                  '저장 파일 만들기'를 누르면
                  <br />
                  결과가 표시돼요
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
          <button
            onClick={generateExport}
            disabled={!image || busy}
            style={{ flex: 1, background: image ? "#C97B4A" : "#3A362F", color: image ? "#141311" : "#767065", border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: image ? "pointer" : "not-allowed" }}
          >
            {busy ? "만드는 중..." : "저장 파일 만들기"}
          </button>
          <button
            onClick={downloadExport}
            disabled={!exportUrl}
            style={{ flex: 1, background: "transparent", color: exportUrl ? "#EDE8DF" : "#5F594E", border: "1px solid #4A453B", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, cursor: exportUrl ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Download size={15} />
            내려받기
          </button>
        </div>

        {/* 템플릿 관리 + JSON */}
        <div style={{ border: "1px solid #322F28", borderRadius: 12, padding: 16, background: "#1B1A17" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>템플릿 관리</span>
            {templatesLoading && (
              <span style={{ fontSize: 12, color: "#8A8377", display: "flex", alignItems: "center", gap: 6 }}>
                <Loader2 size={13} /> 불러오는 중...
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="새 템플릿 이름"
              style={{ flex: 1, boxSizing: "border-box", background: "#141311", border: "1px solid #4A453B", borderRadius: 8, padding: "8px 10px", color: "#EDE8DF", fontSize: 13 }}
            />
            <button onClick={createTemplate} style={{ display: "flex", alignItems: "center", gap: 6, background: "#C97B4A", color: "#141311", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Save size={14} />
              현재 설정 저장
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={exportJson} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "1px solid #4A453B", color: "#EDE8DF", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              <FileJson size={14} />
              JSON 내보내기
            </button>
            <button onClick={() => jsonInputRef.current?.click()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "1px solid #4A453B", color: "#EDE8DF", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              <Upload size={14} />
              JSON 가져오기
            </button>
            <input ref={jsonInputRef} type="file" accept=".json,application/json" onChange={onJsonFileChange} style={{ display: "none" }} />
          </div>

          {importResult && (
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: importResult.ok ? "#16231C" : "#2A1B16",
                border: importResult.ok ? "1px solid #2E5C42" : "1px solid #6B3A28",
                color: importResult.ok ? "#8FD6AC" : "#E8A98A",
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {importResult.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>
                {importResult.ok
                  ? `가져오기 성공 · 가져오기 전 ${importResult.before}개 → 가져온 후 ${importResult.after}개`
                  : `가져오기 거부: ${importResult.reason} (기존 템플릿 ${importResult.before}개 그대로 유지)`}
              </span>
            </div>
          )}

          {templatesError && (
            <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "flex-start", background: "#2A1B16", border: "1px solid #6B3A28", color: "#E8A98A", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{templatesError}</span>
            </div>
          )}

          {!templatesLoading && templates.length === 0 && (
            <div style={{ fontSize: 13, color: "#5F594E", textAlign: "center", padding: "16px 0" }}>아직 저장된 템플릿이 없어요.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: selectedTemplateId === t.id ? "1.5px solid #C97B4A" : "1px solid #322F28", background: "#141311" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#EDE8DF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#767065", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.ratioId} · {t.text ? t.text.slice(0, 18) : "(빈 문구)"}
                  </div>
                </div>
                <button onClick={() => loadTemplate(t.id)} title="불러오기" style={iconBtnStyle}>
                  <FolderOpen size={15} />
                </button>
                <button onClick={() => updateTemplate(t.id)} title="현재 설정으로 수정" style={iconBtnStyle}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteTemplate(t.id)} title="삭제" style={{ ...iconBtnStyle, color: "#E8A98A" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {toast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#26241F", border: "1px solid #4A453B", color: "#EDE8DF", padding: "10px 16px", borderRadius: 10, fontSize: 13 }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtnStyle = {
  background: "transparent",
  border: "1px solid #322F28",
  borderRadius: 8,
  color: "#B4AEA1",
  padding: 8,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
