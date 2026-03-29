import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Priority = "high" | "medium" | "low";
type WorkItemStatus = "open" | "done";
type StatusFilter = "all" | WorkItemStatus;
type PriorityFilter = "all" | Priority;

type WorkItem = {
  id: string;
  title: string;
  details: string;
  priority: Priority;
  status: WorkItemStatus;
  createdAt: string;
};

type Stats = {
  total: number;
  open: number;
  done: number;
  filtered: number;
};

type ProjectProfile = {
  name: string;
  slug: string;
  tagline: string;
  vertical: string;
  brand: string;
  mvp: string[];
  workflow: string[];
  entity: {
    singular: string;
    plural: string;
  };
  copy: {
    titleLabel: string;
    detailsLabel: string;
    createButton: string;
    workspaceTitle: string;
    workspaceDescription: string;
  };
};

type WorkItemsResponse = {
  items: WorkItem[];
  stats: Stats;
};

type MetaResponse = {
  project: ProjectProfile;
};

type Preferences = {
  statusFilter: StatusFilter;
  priorityFilter: PriorityFilter;
  search: string;
};

const platformBrand = "DouglasDev";

const profileDefaults = {
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
} as ProjectProfile;

const defaultStats: Stats = { total: 0, open: 0, done: 0, filtered: 0 };
const defaultForm = { title: "", details: "", priority: "medium" as Priority };

function preferenceKey(slug: string) {
  return `workspace-preferences:${slug}`;
}

function readPreferences(slug: string): Preferences {
  if (typeof window === "undefined") {
    return { statusFilter: "all", priorityFilter: "all", search: "" };
  }

  try {
    const payload = window.localStorage.getItem(preferenceKey(slug));
    if (!payload) {
      return { statusFilter: "all", priorityFilter: "all", search: "" };
    }

    const parsed = JSON.parse(payload) as Partial<Preferences>;
    return {
      statusFilter: parsed.statusFilter ?? "all",
      priorityFilter: parsed.priorityFilter ?? "all",
      search: parsed.search ?? ""
    };
  } catch {
    return { statusFilter: "all", priorityFilter: "all", search: "" };
  }
}

function writePreferences(slug: string, preferences: Preferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(preferenceKey(slug), JSON.stringify(preferences));
}

function revealOnScroll() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

  if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
    for (const node of nodes) {
      node.classList.add("show");
    }
    return () => undefined;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.2 }
  );

  for (const node of nodes) {
    observer.observe(node);
  }

  return () => observer.disconnect();
}

function mapPriority(priority: Priority) {
  const labels: Record<Priority, string> = {
    high: "Alta",
    medium: "Media",
    low: "Baixa"
  };

  return labels[priority];
}

function mapStatus(status: WorkItemStatus) {
  return status === "open" ? "Aberto" : "Concluido";
}

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T;
  return payload;
}

function createQuery(params: { status: StatusFilter; priority: PriorityFilter; q: string }) {
  const query = new URLSearchParams();
  query.set("status", params.status);
  query.set("priority", params.priority);

  if (params.q.trim().length > 0) {
    query.set("q", params.q.trim());
  }

  return query.toString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export default function App() {
  const apiUrl = useMemo(() => import.meta.env.VITE_API_URL || "http://localhost:4000", []);
  const [status, setStatus] = useState<{ ok: boolean; label: string }>({
    ok: true,
    label: "Validando backend..."
  });
  const [meta, setMeta] = useState<ProjectProfile>({
    ...profileDefaults,
    brand: platformBrand
  });
  const [items, setItems] = useState<WorkItem[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");

  const initialPreferences = useMemo(() => readPreferences(profileDefaults.slug), []);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialPreferences.statusFilter);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(initialPreferences.priorityFilter);
  const [searchInput, setSearchInput] = useState(initialPreferences.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialPreferences.search);

  const heroImage = useMemo(() => {
    return `https://picsum.photos/seed/${meta.slug}-hero/1920/1080`;
  }, [meta.slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  useEffect(() => {
    writePreferences(meta.slug, {
      statusFilter,
      priorityFilter,
      search: searchInput
    });
  }, [meta.slug, priorityFilter, searchInput, statusFilter]);

  useEffect(() => {
    const clean = revealOnScroll();
    let active = true;

    async function loadHealthAndMeta() {
      try {
        const healthResponse = await fetch(`${apiUrl}/health`);

        if (!healthResponse.ok) {
          throw new Error("health_failed");
        }

        if (active) {
          setStatus({ ok: true, label: "API online e pronta para operacao real." });
        }
      } catch {
        if (active) {
          setStatus({ ok: false, label: "API indisponivel no momento." });
        }
      }

      try {
        const metaResponse = await fetch(`${apiUrl}/api/meta`);

        if (!metaResponse.ok) {
          throw new Error("meta_failed");
        }

        const metaPayload = await readJson<MetaResponse>(metaResponse);

        if (!active) {
          return;
        }

        setMeta(metaPayload.project);
        const preferences = readPreferences(metaPayload.project.slug);
        setStatusFilter(preferences.statusFilter);
        setPriorityFilter(preferences.priorityFilter);
        setSearchInput(preferences.search);
        setDebouncedSearch(preferences.search);
      } catch {
        if (active) {
          setErrorMessage("Nao foi possivel carregar os metadados do projeto.");
        }
      }
    }

    loadHealthAndMeta();

    return () => {
      active = false;
      clean();
    };
  }, [apiUrl]);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const query = createQuery({
        status: statusFilter,
        priority: priorityFilter,
        q: debouncedSearch
      });

      const response = await fetch(`${apiUrl}/api/work-items?${query}`);

      if (!response.ok) {
        throw new Error("load_failed");
      }

      const payload = await readJson<WorkItemsResponse>(response);
      setItems(payload.items);
      setStats(payload.stats);
      setLastSyncAt(new Date().toISOString());
    } catch {
      setErrorMessage("Nao foi possivel carregar o board operacional.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, debouncedSearch, priorityFilter, statusFilter]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function exportCsv() {
    setExporting(true);

    try {
      const query = createQuery({
        status: statusFilter,
        priority: priorityFilter,
        q: debouncedSearch
      });

      const response = await fetch(`${apiUrl}/api/work-items/export.csv?${query}`);

      if (!response.ok) {
        throw new Error("export_failed");
      }

      const csvContent = await response.text();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${meta.slug}-work-items.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("Nao foi possivel exportar CSV.");
    } finally {
      setExporting(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (form.title.trim().length < 3 || form.details.trim().length < 3) {
      setErrorMessage("Preencha titulo e descricao com no minimo 3 caracteres.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${apiUrl}/api/work-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          details: form.details.trim(),
          priority: form.priority
        })
      });

      if (!response.ok) {
        throw new Error("create_failed");
      }

      setForm(defaultForm);
      await fetchBoard();
    } catch {
      setErrorMessage("Nao foi possivel criar item.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(id: string) {
    setWorkingId(id);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/work-items/${id}/toggle`, {
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error("toggle_failed");
      }

      await fetchBoard();
    } catch {
      setErrorMessage("Nao foi possivel atualizar item.");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteItem(id: string) {
    setWorkingId(id);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/work-items/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("delete_failed");
      }

      await fetchBoard();
    } catch {
      setErrorMessage("Nao foi possivel remover item.");
    } finally {
      setWorkingId(null);
    }
  }

  function resetFilters() {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSearchInput("");
    setDebouncedSearch("");
  }

  return (
    <div className="page">
      <header className="hero full-bleed" style={{ "--hero": `url(${heroImage})` } as CSSProperties}>
        <nav className="nav">
          <p className="brand">
            <span className="brand-main">{platformBrand}</span>
            <span className="brand-sub">{meta.name}</span>
          </p>
          <a className="btn btn-ghost" href="#workspace">
            Workspace
          </a>
        </nav>
        <div className="hero-content">
          <p className="eyebrow">{meta.vertical}</p>
          <h1>{meta.tagline}</h1>
          <p className="lead">
            Produto real da {platformBrand} com API ativa, persistencia local e operacao completa para{" "}
            {meta.entity.plural}.
          </p>
          <div className="actions">
            <a className="btn btn-primary" href="#workspace">
              Abrir operacao
            </a>
            <a className="btn btn-ghost" href="#mvp">
              Ver plano
            </a>
          </div>
          <p className={`status ${status.ok ? "status-ok" : "status-warn"}`}>{status.label}</p>
        </div>
      </header>

      <main className="shell">
        <section id="mvp" className="section" data-reveal>
          <p className="label">MVP estrategico</p>
          <h2>Entrega orientada a execucao de produto.</h2>
          <ul className="list">
            {meta.mvp.map((item) => (
              <li key={item}>
                <span className="dot" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="workspace" className="section" data-reveal>
          <p className="label">Operacao em tempo real</p>
          <h2>{meta.copy.workspaceTitle}</h2>

          <div className="workspace-grid">
            <aside className="panel">
              <p className="label">Resumo</p>
              <h3>Controle operacional ativo</h3>
              <p className="panel-muted">{meta.copy.workspaceDescription}</p>

              <div className="metrics">
                <div className="metric">
                  <span>Total</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="metric">
                  <span>Abertos</span>
                  <strong>{stats.open}</strong>
                </div>
                <div className="metric">
                  <span>Concluidos</span>
                  <strong>{stats.done}</strong>
                </div>
              </div>

              <p className="panel-helper">
                Exibindo {stats.filtered} item(ns) para o filtro atual.
                {lastSyncAt ? ` Ultima sincronizacao: ${formatDateTime(lastSyncAt)}.` : ""}
              </p>

              <form className="form-grid" onSubmit={createItem}>
                <h3>Novo {meta.entity.singular} operacional</h3>

                <div className="field">
                  <label htmlFor="title">{meta.copy.titleLabel}</label>
                  <input
                    id="title"
                    className="input"
                    value={form.title}
                    maxLength={120}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Digite um titulo claro e objetivo"
                  />
                </div>

                <div className="field">
                  <label htmlFor="details">{meta.copy.detailsLabel}</label>
                  <textarea
                    id="details"
                    className="textarea"
                    value={form.details}
                    maxLength={400}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, details: event.target.value }))
                    }
                    placeholder="Descreva o contexto para execucao"
                  />
                </div>

                <div className="field">
                  <label htmlFor="priority">Prioridade</label>
                  <select
                    id="priority"
                    className="select"
                    value={form.priority}
                    onChange={(event) => {
                      const priority = event.target.value as Priority;
                      setForm((current) => ({ ...current, priority }));
                    }}
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Salvando..." : meta.copy.createButton}
                </button>
              </form>
            </aside>

            <section className="panel">
              <div className="board-head">
                <div>
                  <p className="label">Board</p>
                  <h3>Execucao de {meta.entity.plural}</h3>
                </div>
                <div className="filters">
                  <button
                    type="button"
                    className={`chip ${statusFilter === "all" ? "active" : ""}`}
                    onClick={() => setStatusFilter("all")}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className={`chip ${statusFilter === "open" ? "active" : ""}`}
                    onClick={() => setStatusFilter("open")}
                  >
                    Abertos
                  </button>
                  <button
                    type="button"
                    className={`chip ${statusFilter === "done" ? "active" : ""}`}
                    onClick={() => setStatusFilter("done")}
                  >
                    Concluidos
                  </button>
                </div>
              </div>

              <div className="board-tools">
                <input
                  className="input"
                  value={searchInput}
                  placeholder={`Buscar ${meta.entity.plural}`}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <select
                  className="select"
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
                >
                  <option value="all">Prioridade: todas</option>
                  <option value="high">Prioridade: alta</option>
                  <option value="medium">Prioridade: media</option>
                  <option value="low">Prioridade: baixa</option>
                </select>
                <button type="button" className="btn-lite" onClick={resetFilters}>
                  Limpar filtros
                </button>
                <button type="button" className="btn-lite" onClick={exportCsv} disabled={exporting}>
                  {exporting ? "Exportando..." : "Exportar CSV"}
                </button>
              </div>

              {loading ? <p className="panel-muted">Carregando dados...</p> : null}

              {!loading && items.length === 0 ? (
                <div className="empty">Nenhum {meta.entity.singular} encontrado para este filtro.</div>
              ) : null}

              <ul className="item-list">
                {items.map((item) => (
                  <li key={item.id} className="item">
                    <div className="item-top">
                      <h4 className="item-title">{item.title}</h4>
                      <div className="badges">
                        <span className={`badge badge-priority-${item.priority}`}>
                          {mapPriority(item.priority)}
                        </span>
                        <span className={`badge badge-status-${item.status}`}>{mapStatus(item.status)}</span>
                      </div>
                    </div>

                    <p className="item-body">{item.details}</p>

                    <div className="item-actions">
                      <button
                        type="button"
                        className="btn-lite"
                        disabled={workingId === item.id}
                        onClick={() => toggleItem(item.id)}
                      >
                        {item.status === "open" ? "Marcar como concluido" : "Reabrir item"}
                      </button>
                      <button
                        type="button"
                        className="btn-lite btn-danger"
                        disabled={workingId === item.id}
                        onClick={() => deleteItem(item.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {errorMessage ? <p className="feedback">{errorMessage}</p> : null}
            </section>
          </div>
        </section>

        <section className="section split" data-reveal>
          <article>
            <p className="label">Execucao DouglasDev</p>
            <h2>Playbook claro para entregar com consistencia.</h2>
            <ol className="track">
              {meta.workflow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
          <article>
            <p className="label">Produto</p>
            <h2>Base pronta para evoluir sem retrabalho.</h2>
            <p className="lead" style={{ color: "var(--muted)" }}>
              Arquitetura pronta para autenticacao, banco de dados gerenciado e analytics em producao.
            </p>
          </article>
        </section>
      </main>

      <footer className="footer">
        <p>
          {platformBrand} • {meta.name}
        </p>
        <p>{new Date().getFullYear()} - DouglasDev</p>
      </footer>
    </div>
  );
}
