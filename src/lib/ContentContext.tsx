import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedContent, type Product, type SiteContent, type Testimonial } from "./content";
import { hasCloudBackend, loadContent, persistContent, uploadImage } from "./store";

type ContentContextValue = {
  content: SiteContent;
  loading: boolean;
  hasCloudBackend: boolean;
  activeProducts: Product[];
  activeTestimonials: Testimonial[];
  refresh: () => Promise<void>;
  saveAll: (next: SiteContent) => Promise<void>;
  upsertProduct: (product: Product) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  upsertTestimonial: (item: Testimonial) => Promise<void>;
  removeTestimonial: (id: string) => Promise<void>;
  uploadImage: (file: File, folder: "products" | "testimonials") => Promise<string>;
};

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(seedContent);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadContent();
    setContent(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveAll = useCallback(async (next: SiteContent) => {
    const saved = await persistContent(next);
    setContent(saved);
  }, []);

  const upsertProduct = useCallback(
    async (product: Product) => {
      const exists = content.products.some((p) => p.id === product.id);
      const products = exists
        ? content.products.map((p) => (p.id === product.id ? product : p))
        : [...content.products, product];
      await saveAll({ ...content, products });
    },
    [content, saveAll],
  );

  const removeProduct = useCallback(
    async (id: string) => {
      await saveAll({
        ...content,
        products: content.products.filter((p) => p.id !== id),
      });
    },
    [content, saveAll],
  );

  const upsertTestimonial = useCallback(
    async (item: Testimonial) => {
      const exists = content.testimonials.some((t) => t.id === item.id);
      const testimonials = exists
        ? content.testimonials.map((t) => (t.id === item.id ? item : t))
        : [...content.testimonials, item];
      await saveAll({ ...content, testimonials });
    },
    [content, saveAll],
  );

  const removeTestimonial = useCallback(
    async (id: string) => {
      await saveAll({
        ...content,
        testimonials: content.testimonials.filter((t) => t.id !== id),
      });
    },
    [content, saveAll],
  );

  const value = useMemo<ContentContextValue>(
    () => ({
      content,
      loading,
      hasCloudBackend,
      activeProducts: content.products.filter((p) => p.ativo),
      activeTestimonials: content.testimonials.filter((t) => t.ativo),
      refresh,
      saveAll,
      upsertProduct,
      removeProduct,
      upsertTestimonial,
      removeTestimonial,
      uploadImage,
    }),
    [
      content,
      loading,
      refresh,
      saveAll,
      upsertProduct,
      removeProduct,
      upsertTestimonial,
      removeTestimonial,
    ],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used within ContentProvider");
  return ctx;
}
