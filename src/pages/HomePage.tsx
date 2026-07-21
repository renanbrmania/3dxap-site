import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { Catalog } from "../components/Catalog";
import { HowItWorks } from "../components/HowItWorks";
import { Testimonials } from "../components/Testimonials";
import { Contact } from "../components/Contact";
import { Footer, Instagram, WhatsAppFloat } from "../components/SiteExtras";

export function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Catalog />
        <HowItWorks />
        <Testimonials />
        <Instagram />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
