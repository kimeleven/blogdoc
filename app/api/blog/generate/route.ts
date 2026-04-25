import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type BlogRequest = {
  product: {
    name: string;
    reason: string;
    category: string;
    searchKeywords: string[];
  };
  affiliateLink: string;
  affiliateType: "naver-shopping" | "coupang-partners";
  platform: "tistory" | "naver";
  additionalInfo?: string;
};

function buildBlogPrompt(req: BlogRequest) {
  const platformName =
    req.affiliateType === "coupang-partners" ? "쿠팡" : "네이버 쇼핑";

  const platformGuide =
    req.platform === "tistory"
      ? `티스토리 블로그 형식으로 작성하세요.
- HTML 태그 사용 (h2, h3, p, blockquote, strong, em, br, a, img)
- 깔끔한 HTML 포맷으로 출력
- 이미지 삽입: 인터넷에서 찾을 수 있는 상품/관련 이미지 URL을 <img src="이미지URL" alt="설명"> 형태로 3~5개 삽입
- 어필리에이트 링크: <a href="${req.affiliateLink}" target="_blank">구매 링크 텍스트</a> 형식으로 본문에 2~3회 자연스럽게 삽입`
      : `네이버 블로그 형식으로 작성하세요.
- 순수 텍스트 기반 (HTML 태그 사용하지 않음)
- 줄바꿈으로 문단 구분
- 이모지 적절히 활용
- 이미지 위치 표시: [IMAGE: 상품 이미지 설명] 형태로 3~5개 삽입 위치 표시
- 구분선은 ───── 사용
- 어필리에이트 링크를 본문에 2~3회 자연스럽게 삽입: ${req.affiliateLink}`;

  return `당신은 전문 블로그 리뷰어입니다. 아래 상품에 대해 ${platformName} 어필리에이트 블로그 글을 작성하세요.

## 상품 정보
- 상품명: ${req.product.name}
- 카테고리: ${req.product.category}
- 추천 이유: ${req.product.reason}
- 검색 키워드: ${req.product.searchKeywords.join(", ")}
- 어필리에이트 링크: ${req.affiliateLink}
${req.additionalInfo ? `- 추가 정보: ${req.additionalInfo}` : ""}

## 작성 가이드
${platformGuide}

## 블로그 구조
1. 매력적인 제목 (검색 최적화, 키워드 포함)
2. 도입부 - 상품이 필요한 상황/문제 제시
3. 상품 소개 - 핵심 특징 3~5가지
4. 장점/단점 분석 - 솔직한 리뷰 톤
5. 실제 사용 시나리오 - 타겟 독자가 공감할 상황
6. 가격/가성비 분석
7. 구매 유도 - 어필리에이트 링크로 자연스럽게 연결
8. 마무리 - 요약 + 추천 대상

## 핵심 규칙
- 글 분량: 2000~3000자
- SEO 키워드를 제목과 본문에 자연스럽게 포함
- 인터넷에서 찾을 수 있는 실제 이미지 활용 (상품 사진, 사용 장면 등)
- 광고 느낌 최소화, 실제 리뷰어처럼 자연스럽게 작성
- 어필리에이트 링크는 "자세히 보기", "최저가 확인", "구매하기" 등으로 자연스럽게
- 블로그 제목과 본문만 출력 (다른 설명 없이)

출력 형식:
---TITLE---
(블로그 제목)
---BODY---
(블로그 본문)`;
}

async function generateWithClaude(prompt: string): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(
    "/usr/local/bin/claude",
    ["-p", prompt, "--model", "claude-sonnet-4-6"],
    { cwd: "/tmp", env: process.env, timeout: 90000, maxBuffer: 1024 * 1024 * 10 }
  );
  return stdout.trim();
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BlogRequest;

  if (!body.product || !body.affiliateLink) {
    return NextResponse.json(
      { error: "상품 정보와 어필리에이트 링크를 입력해주세요." },
      { status: 400 }
    );
  }

  const prompt = buildBlogPrompt(body);
  let text = "";

  try {
    text = await generateWithClaude(prompt);
  } catch {
    try {
      text = await generateWithGemini(prompt);
    } catch (e) {
      return NextResponse.json(
        { error: `AI 엔진 사용 불가: ${e instanceof Error ? e.message : "unknown"}` },
        { status: 500 }
      );
    }
  }

  const titleMatch = text.match(/---TITLE---\s*([\s\S]*?)\s*---BODY---/);
  const bodyMatch = text.match(/---BODY---\s*([\s\S]*)/);

  const blogTitle = titleMatch?.[1]?.trim() || body.product.name;
  const blogBody = bodyMatch?.[1]?.trim() || text;

  return NextResponse.json({
    title: blogTitle,
    body: blogBody,
    platform: body.platform,
  });
}
