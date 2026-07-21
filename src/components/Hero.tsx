import { motion } from "framer-motion";
import { Logo } from "./BrandMark";
import { Button } from "./Button";
import { whatsappUrl } from "../lib/content";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] w-[min(1120px,calc(100%-1.5rem))] items-center gap-10 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="mb-7 inline-block overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(196,91,134,0.18)] ring-1 ring-rosa/20"
          >
            <Logo height={118} className="mx-auto" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl lg:text-[3.4rem]"
          >
            Peças únicas para histórias únicas
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16 }}
            className="mx-auto mt-4 max-w-lg text-base text-muted sm:text-lg lg:mx-0"
          >
            Impressão 3D criativa com miniaturas, decoração e personalizados — escolha no catálogo e
            peça direto pelo WhatsApp.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24 }}
            className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
          >
            <Button href="#catalogo">Ver catálogo</Button>
            <Button href={whatsappUrl("Olá, vim pelo site da 3DXAP.")} variant="soft">
              Falar no WhatsApp
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
        >
          <div
            className="overflow-hidden rounded-[2rem] bg-blush shadow-[0_24px_60px_rgba(42,36,48,0.12)]"
            style={{ animation: "float-soft 7s ease-in-out infinite" }}
          >
            <img
              src="/estatua.webp"
              alt="Peça decorativa 3DXAP"
              className="h-[min(62vh,500px)] w-full object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
