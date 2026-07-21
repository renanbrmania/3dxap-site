import { useMemo, useState } from "react";
import { useContent } from "../lib/ContentContext";
import { ProductCard } from "./ProductCard";

export function Catalog() {
  const { activeProducts, loading } = useContent();
  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(activeProducts.map((p) => p.categoria)))],
    [activeProducts],
  );
  const [active, setActive] = useState("Todos");

  const filtered =
    active === "Todos" ? activeProducts : activeProducts.filter((p) => p.categoria === active);

  return (
    <section id="catalogo" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto w-[min(1120px,calc(100%-1.5rem))]">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rosa">Catálogo</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">
            Produtos em destaque
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Veja as peças, troque as fotos e peça direto pelo WhatsApp.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {categories.map((category) => {
            const isActive = category === active;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(category)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-rosa text-white shadow-[0_8px_20px_rgba(196,91,134,0.25)]"
                    : "bg-white text-ink/70 ring-1 ring-rosa/10 hover:bg-blush"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-center text-muted">Carregando produtos…</p>
        ) : (
          <div className="flex flex-col items-center gap-10 sm:gap-14">
            {filtered.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
