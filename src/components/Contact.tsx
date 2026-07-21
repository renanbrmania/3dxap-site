import { motion } from "framer-motion";
import { Button } from "./Button";
import { whatsappUrl } from "../lib/content";

export function Contact() {
  return (
    <section id="contato" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto grid w-[min(1120px,calc(100%-1.5rem))] gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[1.75rem] bg-white p-8 shadow-[0_16px_40px_rgba(42,36,48,0.07)] ring-1 ring-rosa/10 sm:p-10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rosa">Contato</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink">Peça pelo WhatsApp</h2>
          <p className="mt-3 text-muted">
            Atendimento rápido para tirar dúvidas, enviar fotos, combinar detalhes e fechar pedidos
            personalizados.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            <li className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-rosa/8">
              <strong className="block text-ink">Marca</strong>
              <span className="text-muted">3DXAP</span>
            </li>
            <li className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-rosa/8">
              <strong className="block text-ink">Produtos</strong>
              <span className="text-muted">Miniaturas, decoração e personalizados</span>
            </li>
            <li className="rounded-2xl bg-cream px-4 py-3 ring-1 ring-rosa/8">
              <strong className="block text-ink">Material</strong>
              <span className="text-muted">PLA e PLA Premium</span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 }}
          className="flex flex-col justify-center rounded-[1.75rem] bg-rosa p-8 text-white shadow-[0_20px_44px_rgba(196,91,134,0.28)] sm:p-10"
        >
          <h3 className="font-display text-3xl font-semibold">Solicite um orçamento</h3>
          <p className="mt-3 text-white/90">
            Envie sua ideia pelo WhatsApp e combine tamanho, estilo, cores e prazo.
          </p>
          <Button
            href={whatsappUrl("Olá, vim pelo site da 3DXAP e quero solicitar um orçamento.")}
            variant="soft"
            className="mt-8 w-full"
          >
            Solicitar orçamento
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
