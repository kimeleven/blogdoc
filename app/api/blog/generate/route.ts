import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

type BlogRequest = {
  product: {
    name: string;
    reason: string;
    category: string;
    searchKeywords: string[];
  };
  affiliateLink: string;
  productUrl?: string;
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
  rawHtml?: string;
};

type CaptureResult = {
  screenshot: string | null;
  galleryImages: string[];
  detailImages: string[];
};

// ─── HTML에서 이미지 URL 추출 (정적 파싱) ────────────────────────────────────
const PRODUCT_CDNS = [
  "coupangcdn.com", "pstatic.net", "naver.com", "samsung.com",
  "lge.com", "kakaocdn.net", "11st.co.kr", "gmarket.co.kr",
  "auction.co.kr", "ssgcdn.com", "lotteimall.com",
];

function isProductImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (url.includes("icon") || url.includes("logo") || url.includes("button") || url.includes("blank")) return false;
  return PRODUCT_CDNS.some((cdn) => url.includes(cdn));
}

function extractImagesFromHtml(html: string, ogImage: string): string[] {
  const images = new Set<string>();
  if (ogImage && isProductImageUrl(ogImage)) images.add(ogImage);

  // 쿠팡 imageUrl
  for (const m of html.matchAll(/"imageUrl"\s*:\s*"(https?:\/\/[^"]+)"/g)) {
    if (isProductImageUrl(m[1])) images.add(m[1]);
  }

  // 네이버 representImage / thumbnailUrl
  for (const m of html.matchAll(/"(?:representImage|thumbnailUrl)"\s*:\s*"(https?:\/\/[^"]+)"/g)) {
    if (isProductImageUrl(m[1])) images.add(m[1]);
  }

  // JSON-LD "image"
  for (const block of (html.match(/"image"\s*:\s*(\[[\s\S]*?\]|"[^"]*")/g) || [])) {
    for (const u of block.match(/https?:\/\/[^\s"']+/g) || []) {
      if (isProductImageUrl(u)) images.add(u);
    }
  }

  // lazy-load data-src
  for (const m of html.matchAll(/data-src="(https?:\/\/[^"]+)"/gi)) {
    if (isProductImageUrl(m[1])) images.add(m[1]);
  }

  return [...images].slice(0, 8);
}

// ─── 네이버 이미지 검색 API ──────────────────────────────────────────────────
async function searchProductImages(productName: string): Promise<string[]> {
  if (!productName) return [];

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[Naver] API 키 없음");
    return [];
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(productName)}&display=8&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );

    if (!res.ok) {
      console.error("[Naver] API 에러:", res.status);
      return [];
    }

    const data = await res.json() as { items?: { link?: string }[] };
    const images = (data.items || [])
      .map((item) => item.link || "")
      .filter((url) => url.startsWith("http") && !url.includes(".gif"))
      .slice(0, 6);

    console.log(`[Naver Search] "${productName}" → ${images.length}개 이미지`);
    return images;
  } catch (e) {
    console.error("[Naver Search] 실패:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ─── 로컬용: Playwright로 스크린샷 + 이미지 추출 ─────────────────────────────
async function captureWithPlaywright(url: string): Promise<CaptureResult> {
  const empty: CaptureResult = { screenshot: null, galleryImages: [], detailImages: [] };
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 900 });

    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "font" || type === "media") route.abort();
      else route.continue();
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.waitForTimeout(3000);
    } catch {
      // 부분 로드라도 계속
    }

    let screenshot: string | null = null;
    try {
      const buf = await page.screenshot({
        type: "jpeg",
        quality: 80,
        clip: { x: 0, y: 0, width: 1200, height: 850 },
      });
      screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {}

    const { galleryImages, detailImages } = await page.evaluate(() => {
      // ⚠️ page.evaluate 브라우저 컨텍스트 — Node.js 변수 참조 불가, 내부 정의 필수
      const CDNS = [
        "coupangcdn.com", "pstatic.net", "naver.com", "samsung.com",
        "lge.com", "kakaocdn.net", "11st.co.kr", "gmarket.co.kr",
        "auction.co.kr", "ssgcdn.com", "lotteimall.com",
      ];
      const isProductImg = (src: string) =>
        src.startsWith("http") &&
        CDNS.some((cdn) => src.includes(cdn)) &&
        !src.includes("icon") &&
        !src.includes("logo");

      const isValid = (el: Element) => {
        const img = el as HTMLImageElement;
        const src = img.src || (img as HTMLElement).dataset?.src || "";
        return img.naturalWidth > 100 && img.naturalHeight > 100 && isProductImg(src);
      };
      const getSrc = (el: Element) => {
        const img = el as HTMLImageElement;
        return img.src || (img as HTMLElement).dataset?.src || "";
      };

      const gallerySelectors = [
        // 쿠팡
        ".prod-image__item img",
        ".prod-image__items img",
        '[class*="prod-img"] img',
        // 네이버
        ".product-image img",
        '[class*="ProductImage"] img',
        '[class*="thumbnail"] img',
        '[class*="gallery"] img',
        // 공통
        ".imgBox img",
        ".goodsPhoto img",
        '[class*="mainImage"] img',
        '[class*="main-img"] img',
      ];
      const gallerySet = new Set<string>();
      for (const sel of gallerySelectors) {
        try { document.querySelectorAll(sel).forEach((el) => { if (isValid(el)) gallerySet.add(getSrc(el)); }); } catch {}
      }

      const detailSelectors = [
        "#productDescription img",
        ".product-detail-content img",
        '[class*="ItemDetail"] img',
        '[class*="productDetail"] img',
        '[class*="DetailImage"] img',
        '[class*="detail-img"] img',
      ];
      const detailSet = new Set<string>();
      for (const sel of detailSelectors) {
        try { document.querySelectorAll(sel).forEach((el) => { if (isValid(el)) detailSet.add(getSrc(el)); }); } catch {}
      }

      return {
        galleryImages: [...gallerySet].slice(0, 5),
        detailImages: [...detailSet].slice(0, 3),
      };
    });

    await browser.close();
    return { screenshot, galleryImages, detailImages };
  } catch (e) {
    console.error("[Playwright] 캡처 실패:", e instanceof Error ? e.message : e);
    return empty;
  }
}

// ─── 환경에 따라 자동 선택 + 이미지 없으면 검색 폴백 ────────────────────────
async function captureProductImages(
  url: string,
  html: string,
  ogImage: string,
  productName: string
): Promise<CaptureResult> {
  if (!url) return { screenshot: null, galleryImages: [], detailImages: [] };

  let galleryImages: string[] = [];
  let detailImages: string[] = [];
  let screenshot: string | null = null;

  if (process.env.VERCEL) {
    // Vercel: HTML 파싱
    const all = extractImagesFromHtml(html, ogImage);
    galleryImages = all.slice(0, 5);
    detailImages = all.slice(5, 8);
  } else {
    // 로컬: Playwright 시도, 실패 시 HTML 파싱
    const pw = await captureWithPlaywright(url);
    if (pw.galleryImages.length > 0 || pw.screenshot) {
      ({ galleryImages, detailImages, screenshot } = pw);
    } else {
      const all = extractImagesFromHtml(html, ogImage);
      galleryImages = all.slice(0, 5);
      detailImages = all.slice(5, 8);
    }
  }

  // 이미지 URL이 부족하면 Bing 검색으로 보충 (스크린샷만 있는 경우도 포함)
  const totalUrlImages = galleryImages.length + detailImages.length;
  if (totalUrlImages < 3 && productName) {
    console.log("[Bing Search] 이미지 부족, 검색 실행:", productName);
    const searched = await searchProductImages(productName);
    if (searched.length > 0) {
      const existing = new Set([...galleryImages, ...detailImages]);
      const extra = searched.filter((s) => !existing.has(s));
      galleryImages = [...galleryImages, ...extra].slice(0, 5);
    }
  }

  return { screenshot, galleryImages, detailImages };
}

// ─── 상품 정보 추출 ───────────────────────────────────────────────────────────
async function fetchProductInfo(url: string): Promise<ProductInfo> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
    });

    const finalUrl = res.url;
    const html = await res.text();

    const getOg = (prop: string) =>
      html.match(new RegExp(`property="og:${prop}"[^>]*content="([^"]*)"`))?.[1] ||
      html.match(new RegExp(`content="([^"]*)"[^>]*property="og:${prop}"`))?.[1] ||
      "";
    const getMeta = (name: string) =>
      html.match(new RegExp(`name="${name}"[^>]*content="([^"]*)"`))?.[1] || "";
    const titleTag =
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.replace(/\s*[-|]\s*.*$/, "").trim() || "";

    const title = getOg("title") || titleTag || "";
    const description = getOg("description") || getMeta("description") || "";
    const image = getOg("image") || "";

    let price = "";
    const priceMatch =
      html.match(/"price"\s*:\s*"?([\d,]+)"?/) ||
      html.match(/class="[^"]*price[^"]*"[^>]*>([\d,]+)/) ||
      html.match(/<span[^>]*판매가[^<]*<\/span>[^<]*<span[^>]*>([\d,]+)/);
    if (priceMatch) price = priceMatch[1] + "원";

    return { title, description, price, image, url: finalUrl, rawHtml: html };
  } catch {
    return { title: "", description: "", price: "", image: "", url, rawHtml: "" };
  }
}

// ─── 이미지 HTML 블록 생성 (티스토리용) ──────────────────────────────────────
function buildTistoryImageBlock(productInfo: ProductInfo, captured: CaptureResult): string {
  const parts: string[] = [];

  const imgTag = (src: string, alt: string) =>
    `<p style="text-align:center;margin:16px 0;"><img src="${src}" alt="${alt}" style="max-width:100%;border-radius:8px;"></p>`;

  if (productInfo.image) parts.push(imgTag(productInfo.image, productInfo.title));

  const extra = captured.galleryImages.filter((s) => s !== productInfo.image);
  extra.slice(0, 3).forEach((s) => parts.push(imgTag(s, productInfo.title)));

  captured.detailImages.slice(0, 2).forEach((s) => parts.push(imgTag(s, "상품 상세")));

  // 이미지 URL이 없을 때만 스크린샷 사용
  if (parts.length === 0 && captured.screenshot) {
    parts.push(imgTag(captured.screenshot, `${productInfo.title} 화면`));
  }

  return parts.join("\n");
}

// ─── Gemini 프롬프트 생성 ─────────────────────────────────────────────────────
function buildBlogPrompt(
  req: BlogRequest,
  productInfo: ProductInfo,
  captured: CaptureResult
): string {
  const platformName = req.affiliateType === "coupang-partners" ? "쿠팡" : "네이버 쇼핑";
  const tistoryImages = buildTistoryImageBlock(productInfo, captured);

  const allImageUrls = [
    ...(productInfo.image ? [productInfo.image] : []),
    ...captured.galleryImages,
    ...captured.detailImages,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const linkButtonHtml =
    `<p style="text-align:center;margin:24px 0;">` +
    `<a href="${req.affiliateLink}" target="_blank" rel="noopener noreferrer" ` +
    `style="display:inline-block;padding:14px 32px;background:#ff6b35;color:#fff;` +
    `font-weight:bold;text-decoration:none;border-radius:8px;font-size:16px;">` +
    `👉 최저가 확인 및 구매하기</a></p>`;

  const platformGuide =
    req.platform === "tistory"
      ? `티스토리 블로그 HTML 형식으로 작성하세요.
- HTML 태그 사용 (h2, h3, p, blockquote, strong, em, a)
${tistoryImages ? `- 도입부 직후 아래 이미지 블록을 반드시 그대로 삽입:\n${tistoryImages}` : ""}
- 【구매 링크 삽입 규칙 — 절대 준수】
  ① 링크는 항상 독립된 <p> 태그 하나에만 넣을 것
  ② 링크 태그(<a>) 앞뒤에 일반 텍스트를 절대 붙이지 말 것
  ③ 아래 버튼 HTML을 그대로 복사해서 본문에 2~3회 삽입:
${linkButtonHtml}
  ④ 각 삽입 위치: 도입부 끝, 본문 중간, 마무리 직전`
      : `네이버 블로그 순수 텍스트 형식으로 작성하세요.
- HTML 태그 사용 금지, 이모지와 줄바꿈으로 구조화
- 구분선: ─────
- 【구매 링크 삽입 규칙 — 절대 준수】
  ① 링크는 반드시 위아래 빈 줄로 분리된 독립 줄에 넣을 것
  ② 같은 줄에 다른 텍스트 절대 금지
  ③ 아래 형식으로 본문에 2~3회 삽입:

  (빈 줄)
  👉 구매 링크: ${req.affiliateLink}
  (빈 줄)
${allImageUrls.length > 0 ? `- 이미지 URL 목록 (블로그 편집기에서 직접 업로드 필요):\n${allImageUrls.map((u) => `  • ${u}`).join("\n")}` : ""}`;

  const productSection = productInfo.title
    ? `## 실제 상품 정보 (크롤링 추출)
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
${captured.screenshot ? "- 상품 페이지 스크린샷 캡처 완료 (이미지 포함됨)" : ""}

## 작성 플랫폼
${platformGuide}

## 블로그 구조
1. 매력적인 제목 (검색 최적화, 상품명 + 핵심 키워드 포함)
2. 도입부 - 독자의 고민 제시
3. 상품 소개 - 핵심 특징 3~5가지
4. 장단점 분석 - 솔직한 리뷰 톤
5. 실제 사용 시나리오
6. 가격/가성비 분석 ${productInfo.price ? `(실제 가격: ${productInfo.price})` : ""}
7. 구매 유도 (링크 독립 블록으로)
8. 마무리 요약

## 핵심 규칙
- 반드시 위 실제 상품 정보 기반으로 작성 (다른 상품 언급 금지)
- 글 분량: 2000~3000자
- SEO 키워드 자연스럽게 포함
- 실제 리뷰어 톤, 광고 느낌 최소화
- 제목과 본문만 출력 (다른 설명 없이)

출력 형식:
---TITLE---
(블로그 제목)
---BODY---
(블로그 본문)`;
}

// ─── Gemini 호출 ──────────────────────────────────────────────────────────────
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

// ─── API 핸들러 ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = (await req.json()) as BlogRequest;

  if (!body.product || !body.affiliateLink) {
    return NextResponse.json(
      { error: "상품 정보와 어필리에이트 링크를 입력해주세요." },
      { status: 400 }
    );
  }

  // 1) 상품 기본 정보 fetch (rawHtml 포함)
  let productInfo: ProductInfo;
  if (body.productUrl?.trim()) {
    productInfo = {
      title: body.productUrl.trim(),
      description: "",
      price: "",
      image: "",
      url: body.affiliateLink,
      rawHtml: "",
    };
  } else {
    productInfo = await fetchProductInfo(body.affiliateLink);
  }

  // 2) 크롤링 실패(403 등) 시 productInfo를 body.product 기반으로 교체
  const ERROR_TITLES = ["access denied", "403", "404", "error", "forbidden", "not found"];
  const isBadTitle = ERROR_TITLES.some((e) => (productInfo.title || "").toLowerCase().includes(e));
  if (isBadTitle || !productInfo.title) {
    productInfo = {
      title: body.product.name,
      description: body.product.reason,
      price: "",
      image: "",
      url: body.affiliateLink,
      rawHtml: productInfo.rawHtml || "",
    };
  }

  // 3) 이미지 캡처 (로컬: Playwright, Vercel: HTML 파싱, 없으면 네이버 검색)
  const productName = body.product.name || body.productUrl || productInfo.title || "";
  const captured = await captureProductImages(
    body.affiliateLink,
    productInfo.rawHtml || "",
    productInfo.image,
    productName
  );

  // 4) Gemini로 블로그 생성
  const prompt = buildBlogPrompt(body, productInfo, captured);

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

  return NextResponse.json({
    title: blogTitle,
    body: blogBody,
    platform: body.platform,
    capturedImages: {
      hasScreenshot: !!captured.screenshot,
      galleryCount: captured.galleryImages.length,
      detailCount: captured.detailImages.length,
    },
  });
}
