"use client";

import { useState, useEffect, useRef } from "react";

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
};

const SUGGEST_MESSAGES = [
  "AI가 트렌드를 분석하고 있습니다...",
  "최신 인기 상품을 탐색하고 있습니다...",
  "카테고리별 추천 상품을 선별하고 있습니다...",
  "수익성 높은 상품을 찾고 있습니다...",
  "거의 다 됐습니다...",
];

const BLOG_MESSAGES = [
  "상품 정보를 분석하고 있습니다...",
  "블로그 제목을 구성하고 있습니다...",
  "본문을 작성하고 있습니다...",
  "SEO 키워드를 삽입하고 있습니다...",
  "어필리에이트 링크를 적용하고 있습니다...",
  "마무리 작업 중입니다...",
];

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
      {/* Spinner */}
      <div className="flex justify-center">
        <div className="w-10 h-10 border-4 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>

      {/* Message */}
      <p className="text-center text-sm text-zinc-300 min-h-[20px] transition-all duration-500">
        {messages[msgIdx]}
      </p>

      {/* Progress bar */}
      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-[2500ms] ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-center text-xs text-zinc-600">
        Gemini AI 처리 중 · 잠시만 기다려주세요
      </p>
    </div>
  );
}

export default function HomePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [affiliateType, setAffiliateType] = useState<AffiliateType>("coupang-partners");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null);
  const [affiliateLink, setAffiliateLink] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [platform, setPlatform] = useState<Platform>("naver");
  const [blogResult, setBlogResult] = useState<BlogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<"suggest" | "blog">("suggest");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
      setStep(2);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const generateBlog = async () => {
    if (!selectedProduct || !affiliateLink.trim()) {
      setError("상품과 어필리에이트 링크를 모두 입력해주세요.");
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
        body: JSON.stringify({ product: selectedProduct, affiliateLink, affiliateType, platform, additionalInfo }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "블로그 생성 실패"); return; }
      setBlogResult(data);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pt-2">
          <h1 className="text-2xl font-bold">BlogDoc</h1>
          <p className="text-zinc-400 text-sm mt-0.5">어필리에이트 상품 블로그 자동 생성</p>
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
              <div className="flex gap-3 mb-6">
                {(["naver-shopping", "coupang-partners"] as AffiliateType[]).map((type) => (
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
                    <div className="text-xs text-zinc-400 mt-1">{type === "naver-shopping" ? "네이버 쇼핑 상품 링크" : "쿠팡 상품 링크"}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={fetchSuggestions}
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                추천 상품 조회
              </button>
            </div>
            {loading && <LoadingOverlay messages={SUGGEST_MESSAGES} />}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">2. 상품 선택</h2>
                <button
                  onClick={() => { setStep(1); setSuggestions([]); setSelectedProduct(null); }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  다시 조회
                </button>
              </div>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedProduct(s)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedProduct === s ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="font-bold text-sm">{s.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">{s.reason}</div>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-700 rounded-full text-zinc-300">{s.category}</span>
                      {s.searchKeywords.slice(0, 3).map((kw, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 bg-zinc-700/50 rounded-full text-zinc-400">{kw}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedProduct && (
              <div className="bg-zinc-900 rounded-xl p-5">
                <h3 className="text-sm font-bold mb-3">어필리에이트 링크 입력</h3>
                <p className="text-xs text-zinc-400 mb-3">
                  {affiliateType === "coupang-partners" ? "쿠팡 파트너스에서 생성한 상품 링크를 입력하세요." : "네이버 쇼핑커넥터에서 생성한 상품 링크를 입력하세요."}
                </p>
                <input
                  type="text"
                  value={affiliateLink}
                  onChange={(e) => setAffiliateLink(e.target.value)}
                  placeholder="https://link.coupang.com/..."
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm mb-3"
                />
                <h3 className="text-sm font-bold mb-2">블로그 플랫폼</h3>
                <div className="flex gap-2 mb-3">
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
                <h3 className="text-sm font-bold mb-2">추가 정보 (선택)</h3>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="강조할 포인트, 타겟 독자 등..."
                  className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-zinc-500 text-sm h-20 resize-none mb-4"
                />
                <button
                  onClick={generateBlog}
                  disabled={loading || !affiliateLink.trim()}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-zinc-200 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  블로그 생성
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            {loading && <LoadingOverlay messages={loadingType === "blog" ? BLOG_MESSAGES : SUGGEST_MESSAGES} />}

            {!loading && blogResult && (
              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">{blogResult.platform === "naver" ? "네이버 블로그" : "티스토리"}</div>
                    <div className="text-lg font-bold">{blogResult.title}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${blogResult.title}\n\n${blogResult.body}`)}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-zinc-700 hover:bg-zinc-600 transition-colors whitespace-nowrap"
                  >
                    {copied ? "복사됨 ✓" : "전체 복사"}
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-zinc-500">블로그 본문</div>
                    <button
                      onClick={() => copyToClipboard(blogResult.body)}
                      className="px-3 py-1 rounded text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      본문만 복사
                    </button>
                  </div>
                  {blogResult.platform === "tistory" ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: blogResult.body }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-zinc-300 leading-relaxed font-sans">{blogResult.body}</pre>
                  )}
                </div>
                <details className="px-5 py-3 border-t border-zinc-800">
                  <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">원본 텍스트 보기 (복사용)</summary>
                  <pre className="mt-3 p-4 bg-zinc-800 rounded-lg text-xs text-zinc-400 whitespace-pre-wrap overflow-auto max-h-96">{blogResult.body}</pre>
                </details>
              </div>
            )}

            <button
              onClick={() => { setStep(1); setBlogResult(null); setSelectedProduct(null); setAffiliateLink(""); setAdditionalInfo(""); setSuggestions([]); }}
              className="w-full py-3 rounded-xl font-bold text-sm bg-zinc-800 text-white hover:bg-zinc-700 transition-all"
            >
              처음부터 다시
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm px-4 py-2.5 rounded-lg mt-4 bg-red-900/40 text-red-400">{error}</div>
        )}
      </div>
    </div>
  );
}
