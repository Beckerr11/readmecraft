# ReadmeCraft

Produto real da DouglasDev para operacao de secoes com painel interativo full stack.

## O que este repositorio entrega
- API Node/Express com validacao de entrada via Zod.
- Persistencia local de dados em arquivo (modo desenvolvimento/producao).
- Filtros reais por status, prioridade e busca textual.
- Exportacao CSV para analise operacional.
- Frontend React responsivo com feedback de carregamento/erro e interacoes completas.

## Fluxo operacional
1. Criar secao com objetivo e publico alvo.
2. Revisar qualidade tecnica e legibilidade final.
3. Concluir melhoria e publicar atualizacao.

## Endpoints principais
- `GET /health`
- `GET /api/meta`
- `GET /api/work-items`
- `GET /api/work-items/export.csv`
- `POST /api/work-items`
- `PATCH /api/work-items/:id/toggle`
- `DELETE /api/work-items/:id`

## Setup
1. `npm install --include=dev`
2. `npm run bootstrap`
3. `npm run dev`

## Qualidade
- `npm run quality` executa lint + testes + build no backend e frontend.

## Marca
DouglasDev
