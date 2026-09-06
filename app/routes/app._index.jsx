import { useFetcher, useLoaderData } from "react-router";
import { useEffect, useState } from "react";

import db from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query PriceFinderProducts {
      products(first: 50) {
        nodes {
          id
          title
          variants(first: 1) {
            nodes {
              id
              price
            }
          }
        }
      }
    }
  `);

  const result = await response.json();

  const products =
    result?.data?.products?.nodes?.map((product) => {
      const firstVariant = product.variants?.nodes?.[0];
      return {
        id: product.id,
        title: product.title,
        price: Number(firstVariant?.price || 0),
      };
    }) || [];

  const savedComparisons = await db.priceComparison.findMany({
    where: { shop: session.shop },
  });

  const comparisons = {};
  for (const comparison of savedComparisons) {
    comparisons[comparison.productId] = {
      competitorPrice: comparison.competitorPrice,
      competitorUrl: comparison.competitorUrl,
      updatedAt: comparison.updatedAt,
    };
  }

  return { products, comparisons };
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "$0.00";

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(number);
}

function ProductRow({ product, savedComparison }) {
  const fetcher = useFetcher();
  const [competitorPrice, setCompetitorPrice] = useState(
    savedComparison?.competitorPrice ?? "",
  );
  const [competitorUrl, setCompetitorUrl] = useState(
    savedComparison?.competitorUrl ?? "",
  );

  useEffect(() => {
    setCompetitorPrice(savedComparison?.competitorPrice ?? "");
    setCompetitorUrl(savedComparison?.competitorUrl ?? "");
  }, [savedComparison?.competitorPrice, savedComparison?.competitorUrl]);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.comparison) {
      setCompetitorPrice(fetcher.data.comparison.competitorPrice ?? "");
      setCompetitorUrl(fetcher.data.comparison.competitorUrl ?? "");
    }
  }, [fetcher.data]);

  const competitorNumber = Number(competitorPrice);
  const hasCompetitorPrice =
    competitorPrice !== "" && Number.isFinite(competitorNumber);
  const difference = hasCompetitorPrice
    ? product.price - competitorNumber
    : null;

  const isSaving = fetcher.state !== "idle";
  const saved = fetcher.data?.success === true;
  const error = fetcher.data?.success === false ? fetcher.data.error : null;
  const hasSavedComparison = Boolean(savedComparison || saved);

  return (
    <tr>
      <td style={styles.cell}>
        <strong>{product.title}</strong>
      </td>

      <td style={styles.cell}>{formatMoney(product.price)}</td>

      <td style={styles.cell}>
        <fetcher.Form method="post" action="/app/save-comparison">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="productTitle" value={product.title} />
          <input type="hidden" name="shopifyPrice" value={product.price} />

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Competitor price</label>
            <input
              type="number"
              name="competitorPrice"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={competitorPrice}
              onChange={(event) => setCompetitorPrice(event.target.value)}
              style={styles.priceInput}
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Competitor URL</label>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              name="competitorUrl"
              placeholder="competitor.com/product"
              value={competitorUrl}
              onChange={(event) => setCompetitorUrl(event.target.value)}
              style={styles.urlInput}
            />
            <div style={styles.hint}>
              You can paste the full link or just competitor.com/product.
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...styles.saveButton,
              ...(isSaving ? styles.disabledButton : {}),
            }}
            disabled={isSaving}
          >
            {isSaving
              ? "Saving..."
              : hasSavedComparison
                ? "Update comparison"
                : "Save comparison"}
          </button>

          {saved && <div style={styles.savedMessage}>✓ Comparison saved</div>}
          {error && <div style={styles.rowError}>{error}</div>}
          {savedComparison?.updatedAt && !saved && (
            <div style={styles.lastSaved}>Saved comparison</div>
          )}
        </fetcher.Form>
      </td>

      <td style={styles.cell}>
        {difference === null ? (
          <span style={styles.muted}>Enter competitor price</span>
        ) : difference > 0 ? (
          <div style={styles.dearer}>
            +{formatMoney(difference)}
            <div style={styles.smallText}>Your Shopify price is dearer</div>
          </div>
        ) : difference < 0 ? (
          <div style={styles.cheaper}>
            {formatMoney(difference)}
            <div style={styles.smallText}>Your Shopify price is cheaper</div>
          </div>
        ) : (
          <div style={styles.same}>
            {formatMoney(0)}
            <div style={styles.smallText}>Same price</div>
          </div>
        )}
      </td>

      <td style={styles.cell}>
        {competitorUrl ? (
          <a
            href={competitorUrl}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            Open competitor
          </a>
        ) : (
          <span style={styles.muted}>No URL saved</span>
        )}
      </td>
    </tr>
  );
}

export default function Index() {
  const { products, comparisons } = useLoaderData();
  const savedCount = Object.keys(comparisons || {}).length;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Shopify Price Finder</h1>
        <p style={styles.subtitle}>
          Compare your Shopify product prices with competitors and save the
          results.
        </p>
        <div style={styles.summary}>
          {products.length} products loaded · {savedCount} comparisons saved
        </div>
      </div>

      <div style={styles.card}>
        {products.length === 0 ? (
          <div style={styles.empty}>No Shopify products found.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.heading}>Product</th>
                  <th style={styles.heading}>Shopify Price</th>
                  <th style={styles.heading}>Competitor</th>
                  <th style={styles.heading}>Price Difference</th>
                  <th style={styles.heading}>Competitor Link</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    savedComparison={comparisons?.[product.id] || null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background: "#f4f6f8",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  header: { maxWidth: "1400px", margin: "0 auto 24px auto" },
  title: { margin: 0, fontSize: "32px", fontWeight: 700, color: "#202223" },
  subtitle: { margin: "8px 0 0", fontSize: "16px", color: "#6d7175" },
  summary: { marginTop: "12px", fontSize: "14px", fontWeight: 600, color: "#4a4a4a" },
  card: {
    maxWidth: "1400px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 5px rgba(0, 0, 0, 0.12)",
  },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  heading: {
    padding: "16px",
    textAlign: "left",
    background: "#f7f7f7",
    borderBottom: "1px solid #ddd",
    fontSize: "14px",
    color: "#303030",
  },
  cell: {
    padding: "16px",
    verticalAlign: "top",
    borderBottom: "1px solid #e5e5e5",
    color: "#303030",
  },
  fieldGroup: { marginBottom: "10px" },
  label: {
    display: "block",
    marginBottom: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#616161",
  },
  priceInput: {
    width: "140px",
    padding: "10px",
    border: "1px solid #c9cccf",
    borderRadius: "6px",
    fontSize: "14px",
  },
  urlInput: {
    width: "280px",
    maxWidth: "100%",
    padding: "10px",
    border: "1px solid #c9cccf",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  hint: {
    marginTop: "4px",
    maxWidth: "280px",
    color: "#6d7175",
    fontSize: "11px",
    lineHeight: 1.35,
  },
  saveButton: {
    marginTop: "2px",
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    background: "#008060",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  },
  disabledButton: { opacity: 0.6, cursor: "wait" },
  savedMessage: {
    marginTop: "8px",
    color: "#008060",
    fontSize: "13px",
    fontWeight: 600,
  },
  lastSaved: { marginTop: "8px", color: "#6d7175", fontSize: "12px" },
  rowError: {
    marginTop: "8px",
    maxWidth: "280px",
    color: "#b42318",
    fontSize: "12px",
    fontWeight: 600,
  },
  cheaper: { color: "#008060", fontWeight: 700 },
  dearer: { color: "#d72c0d", fontWeight: 700 },
  same: { color: "#5c5f62", fontWeight: 700 },
  smallText: { marginTop: "4px", fontSize: "12px", fontWeight: 400 },
  muted: { color: "#8c9196" },
  link: { color: "#2c6ecb", fontWeight: 600, textDecoration: "none" },
  empty: { padding: "40px", textAlign: "center", color: "#6d7175" },
};
