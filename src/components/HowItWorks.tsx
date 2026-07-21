import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "Escolha o produto",
    text: "Navegue pelo catálogo, veja as fotos e filtre por categoria.",
  },
  {
    n: "02",
    title: "Peça pelo WhatsApp",
    text: "Toque em Pedir e fale direto com a 3DXAP.",
  },
  {
    n: "03",
    title: "Combine os detalhes",
    text: "Cores, personalização, quantidade e prazo — tudo no WhatsApp.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-24 py-10 sm:py-14">
      <div className="mx-auto w-[min(1120px,calc(100%-1.5rem))]">
        <div className="rounded-[2rem] bg-rosa px-6 py-10 text-white shadow-[0_24px_50px_rgba(196,91,134,0.28)] sm:px-10 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">
              Como funciona
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Do catálogo ao pedido
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/85">
              Três passos simples para escolher sua peça e fechar com a 3DXAP.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl bg-white/12 p-6 ring-1 ring-white/20 backdrop-blur-sm"
              >
                <span className="font-display text-sm tracking-[0.2em] text-white/70">{step.n}</span>
                <h3 className="mt-3 font-display text-2xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
