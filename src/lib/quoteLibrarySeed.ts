import type { QuoteData } from "./quotePdf";
import type { QuoteLibraryItem } from "./quoteLibrary";

/** Orçamentos recuperados dos PDFs que sumiram do localStorage. */
export const QUOTE_LIBRARY_SEED: QuoteLibraryItem[] = [
  {
    id: "seed-rede-tintou-2026-0727",
    cliente: "Rede Tintou",
    numero: "ORC-2026-0727",
    dataLabel: "27 de julho de 2026",
    createdAt: "2026-07-27T15:00:00.000Z",
    updatedAt: "2026-07-27T15:00:00.000Z",
    data: {
      numero: "ORC-2026-0727",
      cliente: "Rede Tintou",
      data: "27 de julho de 2026",
      validadeDias: 10,
      pix: "60.010.228/0001-94",
      cartao: "Parcelamento em até 3x (com acréscimo de juros da maquininha).",
      telefone: "(49) 9.9116-7161",
      assinatura: "Paula Pacheco",
      cidade: "Chapecó — SC",
      itens: [
        {
          id: "seed-rt-1",
          nome: "Tintinhos (Chaveiro)",
          descricao: "Corpo verde e cabelo roxo.",
          quantidade: 20,
          valorUnitario: 8.5,
        },
        {
          id: "seed-rt-2",
          nome: "Lalatas Pequenas",
          descricao: "Cor branca com laço vermelho.",
          quantidade: 20,
          valorUnitario: 9.5,
        },
        {
          id: "seed-rt-3",
          nome: "Lalatas Pequenas",
          descricao: "Cores variadas (tons claros).",
          quantidade: 10,
          valorUnitario: 8.5,
        },
        {
          id: "seed-rt-4",
          nome: "Lalata Grande",
          descricao: "Aprox. 18 cm. Corpo branco com laço vermelho.",
          quantidade: 1,
          valorUnitario: 80,
        },
      ],
    } satisfies QuoteData,
  },
  {
    id: "seed-simone-matias-2026-0731",
    cliente: "SIMONE MATIAS",
    numero: "ORC-2026-0731",
    dataLabel: "31 de julho de 2026",
    createdAt: "2026-07-31T15:27:00.000Z",
    updatedAt: "2026-07-31T15:27:00.000Z",
    data: {
      numero: "ORC-2026-0731",
      cliente: "SIMONE MATIAS",
      data: "31 de julho de 2026",
      validadeDias: 10,
      pix: "60.010.228/0001-94",
      cartao: "Parcelamento em até 3x (com acréscimo de juros da maquininha).",
      telefone: "(49) 9.9116-7161",
      assinatura: "Paula Pacheco",
      cidade: "Chapecó — SC",
      itens: [
        {
          id: "seed-sm-1",
          nome: "KIT MATEIRA VALENTINA COM BASE",
          descricao: "CORES VARIADAS",
          quantidade: 19,
          valorUnitario: 6.3,
        },
        {
          id: "seed-sm-2",
          nome: "MINI FLOR LOTUS",
          descricao: "VARIAS CORES BEM PEQUENA",
          quantidade: 60,
          valorUnitario: 0.7,
        },
        {
          id: "seed-sm-3",
          nome: "KIT VALENTINA E CUIA (AVULSO)",
          descricao: "CORES VARIADAS",
          quantidade: 16,
          valorUnitario: 3.5,
        },
      ],
    } satisfies QuoteData,
  },
];
