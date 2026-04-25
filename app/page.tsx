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
  "링크에서 상품 정보를 가져오고 있습니다...",
  "상품 특징을 분석하고 있습니다...",
  "블로그 제목을 구성하고 있습니다...",
  "본문을 작성하고 있습니다...",
  "SEO 키워드를 삽입하고 있습니다...",
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
  const [showSuggestions, setShowSuggestions] = useState(false);

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
          affiliateType,
          platform,
          additionalInfo,
        }),
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

  const reset = () => {
    setStep(1); setBlogResult(null); setSelectedProduct(null);
    setAffiliateLink(""); setAdditionalInfo(""); setSuggestions([]);
    setShowSuggestions(false); setError("");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 pt-2">
          <h1 className="text-2xl font-bold">BlogDoc</h1>
          <p className="text-zinc-400 text-sm mt-0.5">어필리에이트 상품 링크 → 블로그 자동 생성</p>
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

        {/* Step 1: 플랫폼 선택 */}
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

        {/* Step 2: 링크 입력 (메인) + AI 추천 참고 */}
        {step === 2 && (
          <div className="space-y-4">
            {/* 링크 입력 — 핵심 */}
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
                className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 focus:outline-none focus:border-blue-500 text-sm mb-4"
              />

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

        {/* Step 3: 결과 */}
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
    </div>
  );
}
