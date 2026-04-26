// Fetch Coupang product info using Gemini
async function fetchCoupangProductInfo(
  productId: string,
  productLink: string,
  affiliateLink: string
): Promise<ProductInfo> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  try {
    // Use Gemini to analyze the product based on product link
    const prompt = `쿠팡 상품 ID: ${productId}
상품 링크: ${productLink}

이 쿠팡 상품의 상세 정보를 제공해주세요. 다음 형식으로 응답해주세요:

상품명: [구체적인 상품명]
가격: [대략적인 가격대]
카테고리: [상품 카테고리]
주요 특징: [상품의 주요 특징 3-5가지]
타겟 고객: [이 상품을 구매할 만한 고객층]

실제 쿠팡에서 판매되는 상품처럼 구체적으로 작성해주세요.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the generated text to extract product info
    const lines = generatedText.split('\n');
    const productInfo: ProductInfo = {
      productId,
      name: '',
      price: '',
      category: '',
      description: '',
      imageUrl: '',
      affiliateLink,
      productLink,
    };

    for (const line of lines) {
      if (line.startsWith('상품명:')) {
        productInfo.name = line.replace('상품명:', '').trim();
      } else if (line.startsWith('가격:')) {
        productInfo.price = line.replace('가격:', '').trim();
      } else if (line.startsWith('카테고리:')) {
        productInfo.category = line.replace('카테고리:', '').trim();
      } else if (line.startsWith('주요 특징:')) {
        productInfo.description = line.replace('주요 특징:', '').trim();
      }
    }

    // Fallback if parsing failed
    if (!productInfo.name) {
      productInfo.name = `쿠팡 상품 ${productId}`;
      productInfo.description = generatedText;
    }

    return productInfo;
  } catch (error) {
    console.error('Error fetching Coupang product info:', error);
    // Return basic info as fallback
    return {
      productId,
      name: `쿠팡 상품 ${productId}`,
      price: '',
      category: '',
      description: '상품 정보를 가져올 수 없습니다. 직접 입력해주세요.',
      imageUrl: '',
      affiliateLink,
      productLink,
    };
  }
}