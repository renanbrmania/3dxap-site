export type Product = {
  id: string;
  nome: string;
  preco: string;
  categoria: string;
  descricao: string;
  material: string;
  imagens: string[];
  whatsapp: string;
  ativo: boolean;
};

export type Testimonial = {
  id: string;
  nome: string;
  texto: string;
  imagem: string;
  ativo: boolean;
};

export type SiteContent = {
  products: Product[];
  testimonials: Testimonial[];
  updatedAt: string;
};

export const WHATSAPP = "5549991167161";

export function whatsappUrl(text?: string) {
  const base = `https://wa.me/${WHATSAPP}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const seedContent: SiteContent = {
  updatedAt: new Date().toISOString(),
  testimonials: [
    {
      id: "t1",
      nome: "Cliente 3DXAP",
      texto: "Peças lindas e delicadas. Atendimento rápido pelo WhatsApp!",
      imagem: "",
      ativo: true,
    },
  ],
  products: [
    {
      id: "p1",
      nome: "Porta lata Personalizado",
      preco: "R$ 39,90 a R$ 49,90",
      categoria: "Porta Lata",
      descricao: "Porta lata personalizado com chaveiro.",
      material: "PLA",
      imagens: ["/portalata.webp", "/portalata2.webp", "/portalata3.webp"],
      whatsapp: "Olá, tenho interesse em Porta lata",
      ativo: true,
    },
    {
      id: "p2",
      nome: "Caixa porta figurinhas",
      preco: "R$ 39,90",
      categoria: "Caixa",
      descricao: "Guarde suas figurinhas de forma segura e bem organizadas.",
      material: "PLA",
      imagens: ["/caixafigurinha.webp", "/caixafigurinha2.webp"],
      whatsapp: "Olá, tenho interesse em Caixa porta figurinhas",
      ativo: true,
    },
    {
      id: "p3",
      nome: "Miniaturas para Pintar (Biscuit)",
      preco: "R$ 3,00 a R$ 4,50",
      categoria: "Miniaturas",
      descricao:
        "Peças miniaturas de 2,5 a 3,5 de tamanho, ideais para biscuit e trabalhos delicados.",
      material: "PLA",
      imagens: ["/biscuit.webp"],
      whatsapp: "Olá, tenho interesse em miniaturas para Biscuit",
      ativo: true,
    },
    {
      id: "p4",
      nome: "Chaveiros Secret Stash",
      preco: "R$ 19,90",
      categoria: "Chaveiro",
      descricao:
        "Toque de charme que faltava na sua bolsa ou mochila, unindo utilidade e moda em só item.",
      material: "PLA",
      imagens: ["/chaveiros-secret-stash.webp"],
      whatsapp: "Olá, tenho interesse em chaveiros personalizados",
      ativo: true,
    },
    {
      id: "p5",
      nome: "Kit dia das Mães",
      preco: "R$ 58,90",
      categoria: "Enfeites",
      descricao: "Porta retrato, porta Celular e um lindo enfeite de Tulipas.",
      material: "PLA",
      imagens: ["/kitmae.webp"],
      whatsapp: "Olá, tenho interesse em kit mãe personalizados",
      ativo: true,
    },
    {
      id: "p6",
      nome: "Kit Corporativo Personalizado",
      preco: "R$ 32,90",
      categoria: "Personalizados",
      descricao:
        "Kit presenteável para clientes, colaboradores e parceiros, com caneca personalizada, chaveiro porta-celular, chocolate premium ou sachê de café e embalagem com visor transparente e laço decorativo.",
      material: "Personalizado",
      imagens: ["/personalizado-dia-dos-pais.webp"],
      whatsapp: "Olá, tenho interesse no Kit Corporativo Personalizado",
      ativo: true,
    },
    {
      id: "p7",
      nome: "Kit Torcedor Mirim",
      preco: "R$ 18,90 o kit",
      categoria: "Personalizados",
      descricao:
        "Deixe a torcida dos pequenos ainda mais divertida! Perfeita para festas temáticas, eventos esportivos, fotos e momentos especiais da Copa.",
      material: "PLA",
      imagens: ["/kit-copa-menina.webp"],
      whatsapp: "Olá, tenho interesse no Kit copa Mirim Personalizado",
      ativo: true,
    },
    {
      id: "p8",
      nome: "Tiara e Óculos Vai Brasil",
      preco: "R$ 10,00 a unidade",
      categoria: "Personalizados",
      descricao:
        "Acessórios Vai Brasil avulsos para os pequenos torcedores: tiara e óculos leves, confortáveis e cheios de estilo.",
      material: "PLA",
      imagens: ["/tiara-vai-brasil.webp", "/oculos-vai-brasil.webp"],
      whatsapp: "Olá, tenho interesse na Tiara/Óculos Vai Brasil (R$ 10,00 a unidade)",
      ativo: true,
    },
    {
      id: "p9",
      nome: "Letras com Nome",
      preco: "R$ 55,00",
      categoria: "Decoração",
      descricao:
        "Personalize o mundo de quem você ama com nossas iniciais decorativas e um toque criativo especial.",
      material: "PLA",
      imagens: ["/letreironome.webp"],
      whatsapp: "Olá, tenho interesse em letras decorativas",
      ativo: true,
    },
    {
      id: "p10",
      nome: "Estátuas Decoração para Consultórios",
      preco: "R$ 250,00 unidade",
      categoria: "Decoração",
      descricao:
        "Ideal para presentear ou para profissionais que buscam um toque moderno e artístico na decoração do seu espaço.",
      material: "PLA Premium",
      imagens: ["/estatua.webp", "/estatua2.webp", "/estatua3.webp", "/estatua4.webp"],
      whatsapp: "Olá, tenho interesse em estátuas decoração",
      ativo: true,
    },
  ],
};
