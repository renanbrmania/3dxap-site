import { useState } from "react";
import { motion } from "framer-motion";
import type { Product } from "../lib/content";
import { whatsappUrl } from "../lib/content";
import { Button } from "./Button";

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const [activeImage, setActiveImage] = useState(0);
  const images = product.imagens;
  const current = images[activeImage] ?? images[0] ?? "";

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.16) }}
      className="mx-auto flex w-full max-w-[420px] flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_44px_rgba(42,36,48,0.1)] ring-1 ring-rosa/10"
    >
      <div className="relative flex min-h-[340px] items-center justify-center bg-gradient-to-b from-blush to-cream p-6 sm:min-h-[420px]">
        {current ? (
          <img
            src={current}
            alt={product.nome}
            className="max-h-[380px] w-full object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-sm text-muted">Sem foto</span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 bg-cream px-4 py-3">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              aria-label={`Ver foto ${i + 1} de ${product.nome}`}
              aria-pressed={i === activeImage}
              onClick={() => setActiveImage(i)}
              className={`h-12 w-12 overflow-hidden rounded-xl border-2 bg-white ${
                i === activeImage ? "border-rosa" : "border-transparent opacity-70"
              }`}
            >
              <img
                src={img}
                alt={`${product.nome} — foto ${i + 1}`}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col bg-blush px-6 py-6 text-ink">
        <h3 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-rosa-deep">
          {product.nome}
        </h3>
        <p className="mt-3 text-center font-display text-4xl font-semibold tracking-wide text-ink">
          {product.preco}
        </p>
        <p className="mt-3 text-center text-sm leading-relaxed text-muted">{product.descricao}</p>
        <Button href={whatsappUrl(product.whatsapp)} className="mt-6 w-full">
          Pedir
        </Button>
      </div>
    </motion.article>
  );
}
