import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { z } from "zod";

const projectProfile = {
  "brand": "DouglasDev",
  "name": "ReadmeCraft",
  "slug": "readmecraft",
  "tagline": "Editor tecnico para documentacao de repositorios com padrao profissional.",
  "vertical": "developer-tools",
  "entity": {
    "singular": "secao",
    "plural": "secoes"
  },
  "copy": {
    "titleLabel": "Titulo da secao",
    "detailsLabel": "Conteudo tecnico esperado",
    "createButton": "Adicionar secao",
    "workspaceTitle": "Workspace de documentacao tecnica",
    "workspaceDescription": "Mantenha padrao DouglasDev de README em todos os repositorios."
  },
  "mvp": [
    "Organizacao de secoes criticas para README forte.",
    "Fila de melhorias de documentacao por impacto.",
    "Checklist de clareza para onboarding rapido.",
    "Painel de progresso para padronizar repositorios."
  ],
  "workflow": [
    "Criar secao com objetivo e publico alvo.",
    "Revisar qualidade tecnica e legibilidade final.",
    "Concluir melhoria e publicar atualizacao."
  ],
  "seedItems": [
    {
      "title": "Guia rapido de setup local",
      "details": "Explicar prerequisitos, comandos e variaveis de ambiente obrigatorias.",
      "priority": "high",
      "status": "open"
    },
    {
      "title": "Fluxo de release e versionamento",
      "details": "Documentar estrategia de branch, tag e publicacao de changelog.",
      "priority": "medium",
      "status": "open"
    },
    {
      "title": "Politica de contribuicao",
      "details": "Definir padrao de PR, qualidade minima e convencao de commits.",
      "priority": "low",
      "status": "done"
    }
  ]
} as const;
const platformBrand = "DouglasDev";

type WorkItemStatus = "open" | "done";
type Priority = "high" | "medium" | "low";

type WorkItem = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  status: WorkItemStatus;
  createdAt: string;
};

const workItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  details: z.string().trim().min(3).max(400),
  priority: z.enum(["high", "medium", "low"]),
  status: z.enum(["open", "done"]),
  createdAt: z.string().datetime()
});

const persistedItemsSchema = z.array(workItemSchema);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default(projectProfile.name),
  APP_VERSION: z.string().default("1.0.0"),
  APP_SLUG: z.string().default(projectProfile.slug),
  APP_VERTICAL: z.string().default(projectProfile.vertical),
  APP_TAGLINE: z.string().default(projectProfile.tagline),
  DATA_DIR: z.string().default(path.resolve(process.cwd(), "data"))
});

export const env = envSchema.parse(process.env);

const runtimeProject = {
  ...projectProfile,
  name: env.APP_NAME,
  slug: env.APP_SLUG,
  vertical: env.APP_VERTICAL,
  tagline: env.APP_TAGLINE,
  brand: platformBrand
};

export const logger = pino({
  name: env.APP_NAME,
  level: env.NODE_ENV === "development" ? "debug" : "info"
});

const persistenceEnabled = env.NODE_ENV !== "test";
const persistenceFilePath = path.join(env.DATA_DIR, `${env.APP_SLUG}-work-items.json`);

const createWorkItemSchema = z.object({
  title: z.string().trim().min(3).max(120),
  details: z.string().trim().min(3).max(400),
  priority: z.enum(["high", "medium", "low"])
});

const listQuerySchema = z.object({
  status: z.enum(["all", "open", "done"]).default("all"),
  priority: z.enum(["all", "high", "medium", "low"]).default("all"),
  q: z.string().trim().max(120).default("")
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

const now = Date.now();
const seedItems: WorkItem[] = runtimeProject.seedItems.map((seed, index) => ({
  id: randomUUID(),
  title: seed.title,
  details: seed.details,
  priority: seed.priority,
  status: seed.status,
  createdAt: new Date(now - index * 1000 * 60 * 7).toISOString()
}));

if (persistenceEnabled) {
  mkdirSync(env.DATA_DIR, { recursive: true });
}

function loadInitialItems() {
  if (!persistenceEnabled) {
    return seedItems;
  }

  if (!existsSync(persistenceFilePath)) {
    return seedItems;
  }

  try {
    const raw = readFileSync(persistenceFilePath, "utf8");
    const parsed = JSON.parse(raw);
    const items = persistedItemsSchema.parse(parsed);
    if (items.length > 0) {
      return items;
    }
  } catch (error) {
    logger.warn({ error }, "failed_to_read_persistence_file_using_seed");
  }

  return seedItems;
}

const store = new Map(loadInitialItems().map((item) => [item.id, item]));

function listWorkItems() {
  return [...store.values()].sort((first, second) => {
    const firstTime = new Date(first.createdAt).getTime();
    const secondTime = new Date(second.createdAt).getTime();
    return secondTime - firstTime;
  });
}

function persistStore() {
  if (!persistenceEnabled) {
    return;
  }

  try {
    const payload = JSON.stringify(listWorkItems(), null, 2);
    writeFileSync(persistenceFilePath, payload, "utf8");
  } catch (error) {
    logger.error({ error }, "failed_to_persist_work_items");
  }
}

persistStore();

function filterWorkItems(
  items: WorkItem[],
  query: {
    status: "all" | WorkItemStatus;
    priority: "all" | Priority;
    q: string;
  }
) {
  const searchText = query.q.toLowerCase();

  return items.filter((item) => {
    if (query.status !== "all" && item.status !== query.status) {
      return false;
    }

    if (query.priority !== "all" && item.priority !== query.priority) {
      return false;
    }

    if (searchText.length > 0) {
      const inTitle = item.title.toLowerCase().includes(searchText);
      const inDetails = item.details.toLowerCase().includes(searchText);
      if (!inTitle && !inDetails) {
        return false;
      }
    }

    return true;
  });
}

function buildStats(items: WorkItem[], filteredCount = items.length) {
  const total = items.length;
  const open = items.filter((item) => item.status === "open").length;
  return {
    total,
    open,
    done: total - open,
    filtered: filteredCount
  };
}

function csvEscape(value: string) {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  return res.status(200).json({
    ok: true,
    service: runtimeProject.name,
    brand: runtimeProject.brand,
    version: env.APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/meta", (_req, res) => {
  return res.status(200).json({
    project: runtimeProject
  });
});

app.get("/api/work-items", (req, res) => {
  const parsedQuery = listQuerySchema.safeParse({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined
  });

  if (!parsedQuery.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_QUERY",
        details: parsedQuery.error.flatten()
      }
    });
  }

  const items = listWorkItems();
  const filteredItems = filterWorkItems(items, parsedQuery.data);

  return res.status(200).json({
    items: filteredItems,
    stats: buildStats(items, filteredItems.length)
  });
});

app.get("/api/work-items/export.csv", (req, res) => {
  const parsedQuery = listQuerySchema.safeParse({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
    q: typeof req.query.q === "string" ? req.query.q : undefined
  });

  if (!parsedQuery.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_QUERY",
        details: parsedQuery.error.flatten()
      }
    });
  }

  const filteredItems = filterWorkItems(listWorkItems(), parsedQuery.data);
  const rows = filteredItems.map((item) =>
    [
      csvEscape(item.id),
      csvEscape(item.title),
      csvEscape(item.details),
      csvEscape(item.priority),
      csvEscape(item.status),
      csvEscape(item.createdAt)
    ].join(",")
  );

  const csv = ["id,title,details,priority,status,createdAt", ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${runtimeProject.slug}-work-items.csv"`
  );

  return res.status(200).send(csv);
});

app.post("/api/work-items", (req, res) => {
  const parsed = createWorkItemSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        details: parsed.error.flatten()
      }
    });
  }

  const item: WorkItem = {
    id: randomUUID(),
    title: parsed.data.title,
    details: parsed.data.details,
    priority: parsed.data.priority,
    status: "open",
    createdAt: new Date().toISOString()
  };

  store.set(item.id, item);
  persistStore();
  const items = listWorkItems();

  return res.status(201).json({ item, stats: buildStats(items) });
});

app.patch("/api/work-items/:id/toggle", (req, res) => {
  const parsedId = idParamSchema.safeParse(req.params);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_ID", message: "Identificador invalido." }
    });
  }

  const current = store.get(parsedId.data.id);

  if (!current) {
    return res.status(404).json({
      success: false,
      error: { code: "ITEM_NOT_FOUND", message: "Item nao encontrado." }
    });
  }

  const updated: WorkItem = {
    ...current,
    status: current.status === "open" ? "done" : "open"
  };

  store.set(updated.id, updated);
  persistStore();
  const items = listWorkItems();

  return res.status(200).json({ item: updated, stats: buildStats(items) });
});

app.delete("/api/work-items/:id", (req, res) => {
  const parsedId = idParamSchema.safeParse(req.params);

  if (!parsedId.success) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_ID", message: "Identificador invalido." }
    });
  }

  const deleted = store.delete(parsedId.data.id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: { code: "ITEM_NOT_FOUND", message: "Item nao encontrado." }
    });
  }

  persistStore();
  return res.status(204).send();
});

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Rota ${req.originalUrl} nao encontrada`
    }
  });
});
