import { motion } from "framer-motion";
import { useContent } from "../lib/ContentContext";

export function Testimonials() {
  const { activeTestimonials } = useContent();

  if (!activeTestimonials.length) return null;

  return (
    <section id="depoimentos" className="scroll-mt-24 bg-cream-deep/70 py-16 sm:py-20">
      <div className="mx-auto w-[min(1120px,calc(100%-1.5rem))]">
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rosa">Depoimentos</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">
            O que nossas clientes dizem
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {activeTestimonials.map((item, i) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="overflow-hidden rounded-[1.5rem] bg-white p-5 shadow-[0_14px_36px_rgba(42,36,48,0.08)] ring-1 ring-rosa/10"
            >
              {item.imagem ? (
                <img
                  src={item.imagem}
                  alt={`Print de ${item.nome}`}
                  className="mb-4 max-h-72 w-full rounded-xl object-contain bg-cream"
                />
              ) : null}
              <p className="text-base leading-relaxed text-ink/85">“{item.texto}”</p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-rosa">
                {item.nome}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
