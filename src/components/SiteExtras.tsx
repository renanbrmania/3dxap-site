import { Logo } from "./BrandMark";
import { Button } from "./Button";
import { whatsappUrl } from "../lib/content";

export function Instagram() {
  return (
    <section id="instagram" className="scroll-mt-24 py-8">
      <div className="mx-auto w-[min(1120px,calc(100%-1.5rem))]">
        <div className="flex flex-col items-start justify-between gap-5 rounded-[1.75rem] bg-blush px-7 py-8 sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rosa">Instagram</p>
            <h3 className="mt-2 font-display text-3xl font-semibold text-ink">
              Acompanhe a 3DXAP
            </h3>
            <p className="mt-2 max-w-xl text-muted">
              Novidades, bastidores e inspirações no perfil oficial.
            </p>
          </div>
          <Button href="https://instagram.com/paulacristina.pacheco">Ver Instagram</Button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="pb-16 pt-6">
      <div className="mx-auto w-[min(1120px,calc(100%-1.5rem))]">
        <div className="rounded-[1.75rem] bg-white px-6 py-10 text-center shadow-[0_14px_36px_rgba(42,36,48,0.06)] ring-1 ring-rosa/10 sm:px-10">
          <div className="mx-auto mb-4 inline-block overflow-hidden rounded-2xl ring-1 ring-rosa/15">
            <Logo height={84} />
          </div>
          <p className="mx-auto max-w-md text-sm text-muted">
            Impressão 3D criativa com peças delicadas, decorativas e personalizadas.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <a href="#catalogo" className="rounded-full bg-cream px-4 py-2 text-sm font-medium ring-1 ring-rosa/10">
              Catálogo
            </a>
            <a href="#depoimentos" className="rounded-full bg-cream px-4 py-2 text-sm font-medium ring-1 ring-rosa/10">
              Depoimentos
            </a>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-cream px-4 py-2 text-sm font-medium ring-1 ring-rosa/10"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFloat() {
  return (
    <a
      href={whatsappUrl("Olá, vim pelo site da 3DXAP.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 right-5 z-[999] flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-2xl text-white shadow-[0_12px_30px_rgba(37,211,102,0.4)] transition hover:scale-110"
    >
      💬
    </a>
  );
}
