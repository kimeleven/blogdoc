import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function buildSuggestPrompt(affiliateType: string) {
  const platformName =
    affiliateType === "coupang-partners" ? "쿠팡 파트너스" : "네이버 쇼핑커넥터";

  return `당신은 한국 이커머스 트렌드 분석 전문가입니다. ${platformName}에서 블로그 어필리에이트로 수익을 내기 좋은 상품 5개를 추천해주세요.

다음 기준으로 선정해주세요:
1. 최근 검색량이 급상승하는 제품
2. 계절/시즌에 맞는 핫한 제품
3. 앞으로 수요가 증가할 것으로 예상되는 제품
4. 블로그 리뷰 글 작성이 용이한 제품 (사진/특징이 풍부한 것)
5. 경쟁이 적당하면서 수수료율이 좋은 카테고리

현재 시점 기준으로 추천해주세요. 반드시 아래 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력:

[
  {
    "name": "상품명",
    "reason": "추천 이유 (1~2문장)",
    "category": "카테고리",
    "searchKeywords": ["검색키워드1", "검색키워드2", "검색키워드3"]
  }
]`;
}

async function generateWithClaude(prompt: string): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(
    "/usr/local/bin/claude",
    ["-p", prompt, "--model", "claude-sonnet-4-6"],
    { cwd: "/tmp", env: process.env, timeout: 60000, maxBuffer: 1024 * 1024 * 10 }
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
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function POST(req: NextRequest) {
  const { affiliateType } = (await req.json()) as { affiliateType: string };
  const prompt = buildSuggestPrompt(affiliateType);

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

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "제품 추천 파싱 실패" }, { status: 500 });
  }

  try {
    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "JSON 파싱 실패" }, { status: 500 });
  }
}
