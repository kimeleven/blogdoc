import type { NextApiRequest, NextApiResponse } from 'next';

// types
interface ProductInfo {
  productId: string;
  name: string;
  price: string;
  category: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
  productLink?: string;
}

interface Suggestion {
  id: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  productUrl: string;
  category: string;
}

interface SuggestResponse {
  suggestions?: Suggestion[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuggestResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { platform, affiliateLink, productLink } = req.body;

  if (!platform || !affiliateLink) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let suggestions: Suggestion[] = [];

    // Extract product ID from affiliate link
    const productId = extractProductId(affiliateLink, platform);

    if (platform === 'coupang' && productId) {
      // Coupang specific handling with productLink
      if (productLink) {
        // For Coupang with productLink, use the enhanced product info
        const productInfo = await fetchCoupangProductInfo(
          productId,
          productLink,
          affiliateLink
        );

        suggestions = [{
          id: productInfo.productId,
          name: productInfo.name,
          description: productInfo.description || `${productInfo.name}에 대한 상세 정보`,
          price: productInfo.price || '가격 정보 확인 필요',
          imageUrl: productInfo.imageUrl || '',
          productUrl: productInfo.affiliateLink,
          category: productInfo.category || '기타',
        }];
      } else {
        // Fallback: generate suggestions based on product ID only
        const productInfo = await fetchProductInfoFromLink(affiliateLink, platform);

        suggestions = [{
          id: productId,
          name: productInfo.name,
          description: productInfo.description,
          price: productInfo.price,
          imageUrl: productInfo.imageUrl,
          productUrl: affiliateLink,
          category: productInfo.category,
        }];
      }
    } else {
      // Generic handling for other platforms
      const productInfo = await fetchProductInfoFromLink(affiliateLink, platform);

      suggestions = [{
        id: productId || 'unknown',
        name: productInfo.name,
        description: productInfo.description,
        price: productInfo.price,
        imageUrl: productInfo.imageUrl,
        productUrl: affiliateLink,
        category: productInfo.category,
      }];
    }

    res.status(200).json({ suggestions });
  } catch (error) {
    console.error('Error in suggest API:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch product suggestions'
    });
  }
}

// Extract product ID from affiliate link
function extractProductId(link: string, platform: string): string | null {
  try {
    if (platform === 'coupang') {
      // Coupang affiliate links: https://link.coupang.com/a/xxxxx
      // Try to extract some identifier
      const match = link.match(/\/a\/(\w+)/);
      return match ? match[1] : null;
    } else if (platform === 'naver') {
      // Naver shopping links
      const match = link.match(/\/(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

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

// Fetch product info from affiliate link (fallback method)
async function fetchProductInfoFromLink(
  link: string,
  platform: string
): Promise<ProductInfo> {
  // This is a placeholder implementation
  // In a real implementation, you would parse the link and fetch product info
  // from the respective platform's API or scrape the product page

  const productId = extractProductId(link, platform) || 'unknown';

  return {
    productId,
    name: platform === 'coupang' ? '쿠팡 상품' : '네이버 쇼핑 상품',
    price: '가격 정보를 가져올 수 없습니다',
    category: '기타',
    description: '상품 정보를 가져올 수 없습니다. 직접 입력해주세요.',
    imageUrl: '',
    affiliateLink: link,
  };
}

// Generate AI suggestions based on product info
async function generateAISuggestions(
  productInfo: ProductInfo,
  platform: string
): Promise<Suggestion[]> {
  // For now, return a single suggestion based on the product info
  return [{
    id: productInfo.productId,
    name: productInfo.name,
    description: productInfo.description,
    price: productInfo.price,
    imageUrl: productInfo.imageUrl,
    productUrl: productInfo.affiliateLink,
    category: productInfo.category,
  }];
}
