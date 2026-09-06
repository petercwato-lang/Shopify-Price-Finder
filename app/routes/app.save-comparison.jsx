import db from "../db.server";
import { authenticate } from "../shopify.server";

function normalizeCompetitorUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsedUrl = new URL(candidate);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
    if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) return null;
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = String(formData.get("productId") || "");
  const productTitle = String(formData.get("productTitle") || "");
  const shopifyPriceValue = String(formData.get("shopifyPrice") || "");
  const competitorPriceValue = String(formData.get("competitorPrice") || "");
  const competitorUrlInput = String(formData.get("competitorUrl") || "");

  const fail = (error) => ({ success: false, productId, error });

  if (!productId) return fail("Missing product ID.");
  if (!productTitle) return fail("Missing product title.");

  const shopifyPrice = Number(shopifyPriceValue);
  const competitorPrice = Number(competitorPriceValue);

  if (!Number.isFinite(shopifyPrice) || shopifyPrice < 0) {
    return fail("Shopify price is invalid.");
  }

  if (
    competitorPriceValue === "" ||
    !Number.isFinite(competitorPrice) ||
    competitorPrice < 0
  ) {
    return fail("Enter a valid competitor price.");
  }

  const competitorUrl = normalizeCompetitorUrl(competitorUrlInput);
  if (competitorUrl === null) {
    return fail(
      "Enter a valid competitor link, for example competitor.com/product or https://competitor.com/product.",
    );
  }

  const comparison = await db.priceComparison.upsert({
    where: {
      shop_productId: {
        shop: session.shop,
        productId,
      },
    },
    update: {
      productTitle,
      shopifyPrice,
      competitorPrice,
      competitorUrl,
    },
    create: {
      shop: session.shop,
      productId,
      productTitle,
      shopifyPrice,
      competitorPrice,
      competitorUrl,
    },
  });

  return {
    success: true,
    productId,
    message: "Comparison saved.",
    comparison: {
      competitorPrice: comparison.competitorPrice,
      competitorUrl: comparison.competitorUrl,
      updatedAt: comparison.updatedAt,
    },
  };
}
