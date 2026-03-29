import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

const item = {
  id: "1f11fd4c-8de9-4de7-9af6-e9277332fc97",
  title: "Item operacional de teste",
  details: "Teste de carregamento real da lista.",
  priority: "high",
  status: "open",
  createdAt: new Date().toISOString()
};

beforeEach(() => {
  const mockFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/health")) {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }

    if (url.includes("/api/meta")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          project: {
            name: "Projeto Teste",
            slug: "projeto-teste",
            tagline: "Painel real com fluxo operacional.",
            vertical: "fullstack",
            mvp: ["Item 1", "Item 2"],
            workflow: ["Passo 1", "Passo 2"],
            entity: { singular: "item", plural: "itens" },
            copy: {
              titleLabel: "Titulo",
              detailsLabel: "Descricao",
              createButton: "Registrar item",
              workspaceTitle: "Workspace real",
              workspaceDescription: "Descricao do workspace"
            },
            seedItems: []
          }
        })
      });
    }

    if (url.includes("/api/work-items") && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [item],
          stats: { total: 1, open: 1, done: 0, filtered: 1 }
        })
      });
    }

    return Promise.resolve({ ok: true, json: async () => ({}) });
  });

  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renderiza painel com dados reais da API", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Registrar item" })).toBeInTheDocument();
  expect(await screen.findByText(item.title)).toBeInTheDocument();
  expect(await screen.findByText("API online e pronta para operacao real.")).toBeInTheDocument();
});
