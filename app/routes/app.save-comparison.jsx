import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = String(formData.get("productId") || "");
  const productTitle = String(formData.get("productTitle") || "");
  const shopifyPriceValue = String(formData.get("shopifyPrice") || "");
  const competitorPriceValue = String(formData.get("competitorPrice") || "");
  const competitorUrl = String(formData.get("competitorUrl") || "").trim();

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

  if (competitorUrl) {
    try {
      const parsedUrl = new URL(competitorUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return fail("Competitor URL must start with http:// or https://.");
      }
    } catch {
      return fail(
        "Enter a valid competitor URL, for example https://competitor.com/product.",
      );
    }
  }

  await db.priceComparison.upsert({
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
  };
}
