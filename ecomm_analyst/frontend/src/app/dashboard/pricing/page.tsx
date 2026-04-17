"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { productsApi, salesApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  marketplace: string;
  image_url: string;
};

type CompetitorCard = {
  name: string;
  price: number;
  diff: number;
  diff_pct: number;
  marketplace: string;
};

type PricingDetail = {
  product_id: number;
  product_name: string;
  product_image: string;
  our_price: number;
  avg_market_price: number;
  price_index: number | null;
  price_diff_pct: number | null;
  price_rank: string;
  pct_above: number;
  pct_below: number;
  competitors: CompetitorCard[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const IMG_BASE = "http://localhost:8000/images";

function ProductImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const fullSrc = src ? `${IMG_BASE}/${src}` : "";

  if (!fullSrc || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-rose-50 text-rose-300 text-xs font-medium ${className ?? ""}`}
      >
        Image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fullSrc}
      alt={alt}
      className={`object-cover ${className ?? ""}`}
      onError={() => setErrored(true)}
    />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [selected, setSelected] = useState<Product | null>(null);
  const [detail, setDetail] = useState<PricingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load all products on mount
  useEffect(() => {
    productsApi
      .list({ limit: 200 })
      .then((r) => setProducts(r.data))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Load pricing detail when a product is selected
  useEffect(() => {
    if (!selected) return;
    setLoadingDetail(true);
    setDetail(null);
    salesApi
      .productPricingDetail(selected.id)
      .then((r) => setDetail(r.data))
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  // ── Detail View ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div>
        <PageHeader
          title="Pricing Product Comparison"
          description="Overview of your store performance across all marketplaces"
        />

        {/* Horizontal product strip with scroll */}
        <div className="overflow-x-auto pb-2 mb-6">
          <div className="flex gap-3 w-max">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all min-w-[90px] ${
                  selected.id === p.id
                    ? "border-rose-400 bg-rose-50 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-xs text-slate-600 text-center leading-tight max-w-[80px] truncate">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all products
        </button>

        {/* Detail section title */}
        <h2 className="text-2xl font-bold text-slate-800 mb-5">
          {selected.name} vs Market Average
        </h2>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          </div>
        ) : detail ? (
          <>
            {/* Metric cards */}
            <div className="flex flex-col gap-3 mb-8">
              {/* Price Index */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-1">Price Index</p>
                {detail.price_index !== null ? (
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-3xl font-bold ${
                        detail.price_index > 105
                          ? "text-red-500"
                          : detail.price_index < 95
                          ? "text-emerald-500"
                          : "text-slate-700"
                      }`}
                    >
                      {detail.price_index}
                    </span>
                    <span className="text-slate-400 text-sm">
                      (100 = market average · Our price ${detail.our_price.toFixed(2)} vs avg $
                      {detail.avg_market_price.toFixed(2)})
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No competitor data available</p>
                )}
              </div>

              {/* Price Difference */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-1">Price Difference (%)</p>
                {detail.price_diff_pct !== null ? (
                  <div className="flex items-center gap-2">
                    {detail.price_diff_pct > 0 ? (
                      <TrendingUp className="w-5 h-5 text-red-500" />
                    ) : detail.price_diff_pct < 0 ? (
                      <TrendingDown className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Minus className="w-5 h-5 text-slate-400" />
                    )}
                    <span
                      className={`text-2xl font-bold ${
                        detail.price_diff_pct > 0
                          ? "text-red-500"
                          : detail.price_diff_pct < 0
                          ? "text-emerald-500"
                          : "text-slate-500"
                      }`}
                    >
                      {detail.price_diff_pct > 0 ? "+" : ""}
                      {detail.price_diff_pct}%
                    </span>
                    <span className="text-slate-400 text-sm">vs market average</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No competitor data available</p>
                )}
              </div>

              {/* Price Rank */}
              <div className="card">
                <p className="text-sm font-semibold text-slate-700 mb-2">Price Rank</p>
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                  <li>{detail.price_rank}</li>
                  <li>
                    <span className="text-red-500 font-medium">{detail.pct_above}%</span> of
                    Products Above Market Price ·{" "}
                    <span className="text-emerald-600 font-medium">{detail.pct_below}%</span> Below
                    Market Price
                  </li>
                </ul>
              </div>
            </div>

            {/* Price Difference section */}
            <h3 className="text-xl font-bold text-slate-800 mb-4">Price Difference</h3>

            {detail.competitors.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                No competitor records for this product
              </p>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3 w-max">
                  {detail.competitors.map((c, i) => {
                    const isOver = c.diff > 0;
                    const isUnder = c.diff < 0;
                    return (
                      <div
                        key={i}
                        className="flex flex-col items-start gap-2 p-3 rounded-xl border border-slate-200 bg-white min-w-[120px] max-w-[140px]"
                      >
                        {/* Placeholder image area for competitor (no real image) */}
                        <div className="w-full h-20 rounded-lg bg-rose-50 flex items-center justify-center text-rose-300 text-xs font-medium">
                          {c.name.split(" ")[0]}
                        </div>
                        <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2">
                          {c.name}
                        </p>
                        <div className="text-xs text-slate-600 space-y-0.5">
                          <p>
                            <span className="text-slate-400">1. Price </span>
                            <span className="font-semibold">${c.price.toFixed(2)}</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <span className="text-slate-400">2. P Diff </span>
                            <span
                              className={`font-semibold ${
                                isOver
                                  ? "text-red-500"
                                  : isUnder
                                  ? "text-emerald-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {isOver ? "+" : ""}
                              {c.diff_pct}%
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    );
  }

  // ── Product Grid View ────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Pricing Product Comparison"
        description="Overview of your store performance across all marketplaces"
      />

      {loadingProducts ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="flex flex-col items-start gap-2 p-0 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-rose-300 transition-all text-left overflow-hidden group"
            >
              <div className="w-full aspect-square overflow-hidden bg-rose-50">
                <ProductImage
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="px-3 pb-3">
                <p className="text-sm font-medium text-slate-700 line-clamp-2 leading-tight">
                  {p.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
