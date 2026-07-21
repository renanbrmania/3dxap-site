import { Logo } from "./BrandMark";
import { whatsappUrl } from "../lib/content";

const links = [
  { href: "#catalogo", label: "Catálogo" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#contato", label: "Contato" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-rosa/10 bg-cream/85 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.5rem] w-[min(1120px,calc(100%-1.5rem))] items-center justify-between gap-4 py-2">
        <a href="#" className="block shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-rosa/15">
          <Logo height={48} />
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-blush hover:text-rosa-deep"
            >
              {link.label}
            </a>
          ))}
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 rounded-full bg-rosa px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(196,91,134,0.25)] transition hover:bg-rosa-deep"
          >
            WhatsApp
          </a>
        </nav>
      </div>
    </header>
  );
}
