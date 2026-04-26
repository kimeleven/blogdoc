"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type AffiliateType = "naver-shopping" | "coupang-partners";
type Platform = "tistory" | "naver";

type ProductSuggestion = {
  name: string;
  reason: string;
  category: string;
  searchKeywords: string[];
};

type BlogResult = {
  title: string;
  body: string;
  platform: Platform;
  images?: string[];
  productName?: string;
};

type HistoryItem = {
  id: string;
  title: string;
  body: string;
  platform: Platform;
  affiliateType: AffiliateType;
  affiliateLink: string;
  productName: string;
  createdAt: string;
};

const HISTORY_KEY = "blogdoc-history";
const MAX_HISTORY = 50;

const SUGGEST_MESSAGES = [
  "AI가 트렌드를 분석하고 있습니다...",
  "최신 인기 상품을 탐색하고 있습니다...",
  "카테고리별 추천 상품을 선별하고 있습니다...",
  "수익성 높은 상품을 찾고 있습니다...",
  "거의 다 됐습니다...",
];

const BLOG_MESSAGES = [
  "링크에서 상품 정보를 가져오고 있습니다...",
  "상품 특징을 분석하고 있습니다...",
  "블로그 제목을 구성하고 있습니다...",
  "본문을 작성하고 있습니다...",
  "SEO 키워드를 삽입하고 있습니다...",
  "마무리 작업 중입니다...",
];

function ImageCard({ url, index }: { url: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleClick = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="aspect-square rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-600 text-[10px] text-center p-2 hover:border-zinc-500 transition-colors"
      >
        이미지 {index + 1}
        <br />열기 →
      </a>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 hover:border-zinc-500 transition-colors group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`상품 이미지 ${index + 1}`}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
      <div className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <span className="text-white text-[10px] font-medium">{copied ? "복사됨 ✓" : "URL 복사"}</span>
      </div>
    </button>
  );
}

function LoadingOverlay({ messages }: { messages: string[] }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMsgIdx(0);
    setProgress(0);
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += 1;
      setProgress(Math.min(elapsed * 3, 90));
      setMsgIdx((i) => Math.min(i + 1, messages.length - 1));
    }, 2500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [messages]);

  return (
    <div className="bg-zinc-900 rounded-xl p-8 space-y-5">
      <div className="flex justify-center">
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
      <p className="text-center text-sm text-zinc-300 min-h-[20px]">{messages[msgIdx]}</p>
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-[2500ms] ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-center text-xs text-zinc-600">Gemini AI 처리 중 · 잠시만 기다려주세요</p>
    </div>
  );
}

function HistoryPanel({
  open,
  onClose,
  history,
  onRestore,
  onDelete,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const copyItem = (item: HistoryItem) => {
    navigator.clipboard.writeText(`${item.title}\n\n${item.body}`);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const DD = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${MM}/${DD} ${hh}:${mm}`;
  };

  return (
    <>
      {/* backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      {/* panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <div className="font-bold text-sm">히스토리</div>
            <div className="text-xs text-zinc-500">{history.length}개 저장됨</div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
              >
                전체 삭제
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 && (
            <div className="text-center py-12 text-zinc-600 text-sm">
              아직 생성된 블로그 글이 없습니다
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
              <div className="p-3">
                <div className="flex items-start gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white leading-snug line-clamp-2">{item.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.platform === "naver" ? "bg-green-900/50 text-green-400" : "bg-orange-900/50 text-orange-400"}`}>
                        {item.platform === "naver" ? "네이버" : "티스토리"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.affiliateType === "coupang-partners" ? "bg-blue-900/50 text-blue-400" : "bg-emerald-900/50 text-emerald-400"}`}>
                        {item.affiliateType === "coupang-partners" ? "쿠팡" : "네이버쇼핑"}
                      </span>
                      <span className="text-[10px] text-zinc-600">{formatDate(item.createdAt)}</span>
                    </div>
                    {item.productName && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{item.productName}</div>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="shrink-0 w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => { onRestore(item); onClose(); }}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => copyItem(item)}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                  >
                    {copiedId === item.id ? "복사됨 ✓" : "복사"}
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors"
                  >
                    {expandedId === item.id ? "접기" : "미리보기"}
                  </button>
                </div>
              </div>

              {expandedId === item.id && (
                <div className="px-3 pb-3 border-t border-zinc-800 pt-2">
                  <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap line-clamp-6 font-sans leading-relaxed">
                    {item.body}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function HomePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [affiliateType, setAffiliateType] = useState<AffiliateType>("coupang-partners");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null);
  const [affiliateLink, setAffiliateLink] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [platform, setPlatform] = useState<Platform>("naver");
  const [blogResult, setBlogResult] = useState<BlogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"suggest" | "blog">("suggest");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  const saveToHistory = useCallback((result: BlogResult, link: string, pName: string, affType: AffiliateType) => {
    const item: HistoryItem = {
      id: Date.now().toString(),
      title: result.title,
      body: result.body,
      platform: result.platform,
      affiliateType: affType,
      affiliateLink: link,
      productName: pName,
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const deleteHistory = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
  };

  const restoreHistory = (item: HistoryItem) => {
    setBlogResult({ title: item.title, body: item.body, platform: item.platform });
    setAffiliateLink(item.affiliateLink);
    setAffiliateType(item.affiliateType);
    setPlatform(item.platform);
    setStep(3);
  };

  const fetchSuggestions = async () => {
    setLoading(true);
    setLoadingType("suggest");
    setError("");
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "제품 후보 조회 실패"); return; }
      setSuggestions(data.suggestions);
      setShowSuggestions(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const generateBlog = async () => {
    if (!affiliateLink.trim()) {
      setError("어필리에이트 링크를 입력해주세요.");
      return;
    }
    setLoading(true);
    setLoadingType("blog");
    setError("");
    setStep(3);
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProduct ?? { name: "", reason: "", category: "", searchKeywords: [] },
          affiliateLink,
          productUrl,
          affiliateType,
          platform,
          additionalInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "블로그 생성 실패"); return; }
      setBlogResult(data);
      saveToHistory(
        data,
        affiliateLink,
        productUrl || selectedProduct?.name || "",
        affiliateType
      );
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep(1); setBlogResult(null); setSelectedProduct(null);
    setAffiliateLink(""); setAdditionalInfo(""); setSuggestions([]);
    setShowSuggestions(false); setError("");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">BlogDoc</h1>
            <p className="text-zinc-400 text-sm mt-0.5">어필리에이트 상품 링크 → 블로그 자동 생성</p>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-zinc-300"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            히스토리
            {history.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white px-1">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 transition-colors ${
                s < step ? "bg-blue-500 text-white" :
                s === step ? "bg-blue-500 text-white ring-2 ring-blue-500/30" :
                "bg-zinc-800 text-zinc-500"
              }`}>
                {s < step ? "✓" : s}
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 rounded-full transition-colors ${s < step ? "bg-blue-500" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-5">
              <h2 className="text-lg font-bold mb-4">1. 어필리에이트 플랫폼 선택</h2>
              <div className="flex gap-3 mb-4">
                {(["coupang-partners", "naver-shopping"] as AffiliateType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAffiliateType(type)}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
                      affiliateType === type
                        ? type === "naver-shopping" ? "border-green-500 bg-green-500/10" : "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="font-bold text-sm">{type === "naver-shopping" ? "네이버 쇼핑커넥터" : "쿠팡 파트너스"}</div>
                    <div className="text-xs text-zinc-400 mt-1">{type === "naver-shopping" ? "네이버 쇼핑 링크" : "쿠팡 상품 링크"}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-zinc-200 transition-all active:scale-[0.98]"
              >
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">2. 어필리에이트 링크 입력</h2>
                <button onClick={() => setStep(1)} className="text-xs text-zinc-500 hover:text-white transition-colors">← 뒤로</button>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                {affiliateType === "coupang-partners" ? "쿠팡 파트너스" : "네이버 쇼핑커넥터"}에서 생성한 상품 링크를 붙여넣으세요.<br />
                <span className="text-blue-400">링크의 실제 상품 정보를 분석해서 리뷰를 작성합니다.</span>
              </p>
              <input
                type="text"
                value={affiliateLink}
                onChange={(e) => setAffiliateLink(e.target.value)}
                placeholder={affiliateType === "coupang-partners" ? "https://link.coupang.com/..." : "https://search.shopping.naver.com/..."}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-blue-500 text-sm mb-2"
              />
              <p className="text-xs text-zinc-500 mb-4">블로그 본문에 삽입될 어필리에이트 링크입니다.</p>

              <h3 className="text-sm font-bold mb-2">상품명 <span className="text-zinc-500 font-normal">(선택)</span></h3>
              <input
                type="text"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder={affiliateType === "coupang-partners" ? "예: 삼성 55인치 QLED TV" : "예: 라네즈 립슬리핑 마스크"}
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-blue-500 text-sm mb-2"
              />
              <p className="text-xs text-zinc-500 mb-4">AI가 이 상품명으로 검색하여 실제 정보를 분석해 리뷰를 작성합니다.</p>

              <h3 className="text-sm font-bold mb-2">블로그 플랫폼</h3>
              <div className="flex gap-2 mb-4">
                {(["naver", "tistory"] as Platform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                      platform === p
                        ? p === "naver" ? "bg-green-600/20 text-green-400 border border-green-600/30" : "bg-orange-600/20 text-orange-400 border border-orange-600/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {p === "naver" ? "네이버 블로그" : "티스토리"}
                  </button>
                ))}
              </div>

              <h3 className="text-sm font-bold mb-2">추가 요청사항 <span className="text-zinc-500 font-normal">(선택)</span></h3>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="예: 20~30대 여성 타겟, 가성비 위주로 강조해주세요"
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm h-20 resize-none mb-4"
              />

              <button
                onClick={generateBlog}
                disabled={!affiliateLink.trim()}
                className="w-full py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                블로그 생성
              </button>
            </div>

            {/* AI 추천 — 참고용 */}
            <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300">AI 추천 상품 <span className="text-xs text-zinc-500 ml-1">— 링크 발굴 참고용</span></h3>
                  <p className="text-xs text-zinc-600 mt-0.5">어떤 상품을 포스팅할지 모르겠다면 아래에서 아이디어를 얻으세요.</p>
                </div>
                {!showSuggestions && !loading && (
                  <button
                    onClick={fetchSuggestions}
                    className="px-3 py-1.5 text-xs rounded-lg bg-zinc-700 hover:bg-zinc-600 transition-colors whitespace-nowrap"
                  >
                    추천 받기
                  </button>
                )}
              </div>

              {loading && loadingType === "suggest" && <LoadingOverlay messages={SUGGEST_MESSAGES} />}

              {showSuggestions && suggestions.length > 0 && (
                <div className="space-y-2 mt-3">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedProduct(s)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedProduct === s ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                      }`}
                    >
                      <div className="font-bold text-sm">{s.name}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{s.reason}</div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 bg-zinc-700 rounded-full text-zinc-300">{s.category}</span>
                        {s.searchKeywords.slice(0, 3).map((kw, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 bg-zinc-700/50 rounded-full text-zinc-500">{kw}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                  <button onClick={fetchSuggestions} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
                    다시 추천받기 →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && <LoadingOverlay messages={BLOG_MESSAGES} />}

            {!loading && blogResult && (
              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500 mb-1">{blogResult.platform === "naver" ? "네이버 블로그" : "티스토리"}</div>
                    <div className="text-base font-bold leading-snug">{blogResult.title}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${blogResult.title}\n\n${blogResult.body}`)}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-700 hover:bg-zinc-600 transition-colors whitespace-nowrap shrink-0"
                  >
                    {copied ? "복사됨 ✓" : "전체 복사"}
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-zinc-500">블로그 본문</div>
                    <button onClick={() => copyToClipboard(blogResult.body)} className="px-3 py-1 rounded text-xs text-zinc-400 hover:text-white transition-colors">
                      본문만 복사
                    </button>
                  </div>
                  {blogResult.platform === "tistory" ? (
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: blogResult.body }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">{blogResult.body}</pre>
                  )}
                </div>
                {/* 이미지 섹션 */}
                <div className="px-5 py-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-zinc-400">상품 이미지</div>
                    {blogResult.platform === "naver" ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">직접 업로드 필요</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-400">HTML에 자동 삽입됨</span>
                    )}
                  </div>

                  {blogResult.images && blogResult.images.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {blogResult.images.map((url, i) => (
                          <ImageCard key={i} url={url} index={i} />
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-600">이미지를 클릭하면 URL이 복사됩니다.</p>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500">이미지를 가져오지 못했습니다. 아래 링크에서 직접 검색하세요.</p>
                      <div className="flex flex-col gap-1.5">
                        <a
                          href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(blogResult.productName || blogResult.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30 text-green-400 text-xs hover:bg-green-900/30 transition-colors"
                        >
                          <span>🔍</span> 네이버 쇼핑에서 이미지 검색
                        </a>
                        <a
                          href={`https://www.coupang.com/np/search?q=${encodeURIComponent(blogResult.productName || blogResult.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900/20 border border-blue-800/30 text-blue-400 text-xs hover:bg-blue-900/30 transition-colors"
                        >
                          <span>🔍</span> 쿠팡에서 이미지 검색
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <details className="px-5 py-3 border-t border-zinc-800">
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">원본 텍스트 (복사용)</summary>
                  <pre className="mt-3 p-4 bg-zinc-800 rounded-lg text-xs text-zinc-400 whitespace-pre-wrap overflow-auto max-h-96">{blogResult.body}</pre>
                </details>
              </div>
            )}

            <button onClick={reset} className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all">
              처음부터 다시
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm px-4 py-2.5 rounded-lg mt-4 bg-red-900/40 text-red-400">{error}</div>
        )}
      </div>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onRestore={restoreHistory}
        onDelete={deleteHistory}
        onClear={clearHistory}
      />
    </div>
  );
}
