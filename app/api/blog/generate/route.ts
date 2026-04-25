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

type ProductInfo = {
  title: string;
  description: string;
  price: string;
  image: string;
  url: string;
};

// 어필리에이트 링크에서 실제 상품 정보 추출
async function fetchProductInfo(url: string): Promise<ProductInfo> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
    });

    const finalUrl = res.url;
    const html = await res.text();

    // og: meta tags
    const getOg = (prop: string) =>
      html.match(new RegExp(`property="og:${prop}"[^>]*content="([^"]*)"`))?.[1] ||
      html.match(new RegExp(`content="([^"]*)"[^>]*property="og:${prop}"`))?.[1] || "";

    // 일반 meta
    const getMeta = (name: string) =>
      html.match(new RegExp(`name="${name}"[^>]*content="([^"]*)"`))?.[1] || "";

    // title 태그
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s*[-|]\s*.*$/, "").trim() || "";

    const title = getOg("title") || titleTag || "";
    const description = getOg("description") || getMeta("description") || "";
    const image = getOg("image") || "";

    // 쿠팡 가격 추출
    let price = "";
    const priceMatch =
      html.match(/"price"\s*:\s*"?([\d,]+)"?/) ||
      html.match(/class="[^"]*price[^"]*"[^>]*>([\d,]+)/) ||
      html.match(/<span[^>]*판매가[^<]*<\/span>[^<]*<span[^>]*>([\d,]+)/);
    if (priceMatch) price = priceMatch[1] + "원";

    return { title, description, price, image, url: finalUrl };
  } catch {
    return { title: "", description: "", price: "", image: "", url };
  }
}

function buildBlogPrompt(req: BlogRequest, productInfo: ProductInfo) {
  const platformName = req.affiliateType === "coupang-partners" ? "쿠팡" : "네이버 쇼핑";

  const platformGuide =
    req.platform === "tistory"
      ? `티스토리 블로그 형식으로 작성하세요.
- HTML 태그 사용 (h2, h3, p, blockquote, strong, em, br, a)
- 깔끔한 HTML 포맷으로 출력
${productInfo.image ? `- 첫 번째 이미지: <img src="${productInfo.image}" alt="${productInfo.title}" style="max-width:100%">` : ""}
- 어필리에이트 링크: <a href="${req.affiliateLink}" target="_blank" rel="noopener">구매 링크 텍스트</a> 형식으로 본문에 2~3회 자연스럽게 삽입`
      : `네이버 블로그 형식으로 작성하세요.
- 순수 텍스트 기반 (HTML 태그 사용하지 않음)
- 줄바꿈으로 문단 구분, 이모지 적절히 활용
- 구분선은 ───── 사용
- 어필리에이트 링크를 본문에 2~3회 자연스럽게 삽입: ${req.affiliateLink}`;

  const productSection = productInfo.title
    ? `## 실제 상품 정보 (링크에서 직접 추출)
- 상품명: ${productInfo.title}
${productInfo.price ? `- 가격: ${productInfo.price}` : ""}
${productInfo.description ? `- 상품 설명: ${productInfo.description}` : ""}
- 상품 URL: ${productInfo.url}`
    : `## 상품 정보 (AI 추천 기반)
- 상품명: ${req.product.name}
- 카테고리: ${req.product.category}
- 추천 이유: ${req.product.reason}`;

  return `당신은 전문 블로그 리뷰어입니다. 아래 실제 상품에 대해 ${platformName} 어필리에이트 블로그 글을 작성하세요.

${productSection}
- 어필리에이트 링크: ${req.affiliateLink}
- 검색 키워드: ${req.product.searchKeywords.join(", ")}
${req.additionalInfo ? `- 추가 요청사항: ${req.additionalInfo}` : ""}

## 작성 플랫폼
${platformGuide}

## 블로그 구조
1. 매력적인 제목 (검색 최적화, 상품명 + 핵심 키워드 포함)
2. 도입부 - 이 상품이 필요한 상황/독자의 고민 제시
3. 상품 소개 - 위 상품 정보를 바탕으로 핵심 특징 3~5가지 구체적으로
4. 장단점 분석 - 솔직한 리뷰 톤
5. 실제 사용 시나리오 - 타겟 독자가 공감할 상황
6. 가격/가성비 분석 ${productInfo.price ? `(실제 가격: ${productInfo.price} 반영)` : ""}
7. 구매 유도 - 어필리에이트 링크로 자연스럽게 연결
8. 마무리 - 요약 + 추천 대상

## 핵심 규칙
- 반드시 위에 제공된 실제 상품 정보를 기반으로 작성 (다른 상품 이야기 금지)
- 글 분량: 2000~3000자
- SEO 키워드를 제목과 본문에 자연스럽게 포함
- 광고 느낌 최소화, 실제 리뷰어처럼 자연스럽게 작성
- 블로그 제목과 본문만 출력 (다른 설명 없이)

출력 형식:
---TITLE---
(블로그 제목)
---BODY---
(블로그 본문)`;
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
    return NextResponse.json({ error: "상품 정보와 어필리에이트 링크를 입력해주세요." }, { status: 400 });
  }

  // 실제 상품 페이지에서 정보 추출
  const productInfo = await fetchProductInfo(body.affiliateLink);

  const prompt = buildBlogPrompt(body, productInfo);

  let text = "";
  try {
    text = await generateWithGemini(prompt);
  } catch (e) {
    return NextResponse.json(
      { error: `AI 엔진 사용 불가: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 }
    );
  }

  const titleMatch = text.match(/---TITLE---\s*([\s\S]*?)\s*---BODY---/);
  const bodyMatch = text.match(/---BODY---\s*([\s\S]*)/);

  const blogTitle = titleMatch?.[1]?.trim() || productInfo.title || body.product.name;
  const blogBody = bodyMatch?.[1]?.trim() || text;

  return NextResponse.json({ title: blogTitle, body: blogBody, platform: body.platform });
}
