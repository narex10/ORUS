# ORUS — Intelligence Platform for Media Buyers

> Plataforma completa de inteligência, rastreamento real e automação para media buyers. Conecta gerenciadores de anúncios, rastreia cadastros e compras reais (mesmo com cloaker), analisa criativos, gerencia audiências e automatiza escala.

---

## Stack

| Camada     | Tecnologia                                      |
|------------|-------------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Recharts |
| Backend    | Node.js + Express + TypeScript                  |
| Banco      | PostgreSQL 16 + Prisma ORM                      |
| Cache      | Redis 7                                         |
| Auth       | JWT + sessões no banco                          |
| Infra      | Docker + Docker Compose                         |

---

## Estrutura de Pastas

```
ORUS/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma          ← Schema completo (User, Profile, Campaign, Metrics, etc.)
│   └── src/
│       ├── index.ts               ← Entry point
│       ├── app.ts                 ← Express app (middleware, routes)
│       ├── config/env.ts          ← Validação de variáveis de ambiente (Zod)
│       ├── lib/
│       │   ├── prisma.ts          ← Singleton do PrismaClient
│       │   └── crypto.ts          ← Criptografia AES-256-GCM (tokens)
│       ├── middleware/
│       │   ├── auth.ts            ← JWT + validação de sessão
│       │   └── errorHandler.ts
│       ├── routes/                ← Roteamento por domínio
│       │   ├── auth.ts
│       │   ├── profiles.ts
│       │   ├── dashboard.ts
│       │   ├── campaigns.ts
│       │   ├── integrations.ts
│       │   ├── audiences.ts
│       │   ├── rules.ts
│       │   └── tracking.ts        ← Recebe conversões + serve script JS
│       └── controllers/
│           ├── authController.ts
│           ├── profileController.ts
│           ├── dashboardController.ts
│           └── trackingController.ts  ← Script com suporte a cloaker
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx                ← Rotas + React Query + Auth guard
        ├── index.css              ← Dark mode (CSS vars HSL)
        ├── types/index.ts
        ├── lib/
        │   ├── api.ts             ← Axios com interceptors JWT
        │   └── utils.ts           ← cn, formatCurrency, formatROAS...
        ├── store/authStore.ts     ← Zustand (token, user, activeProfile)
        ├── hooks/
        │   ├── useProfiles.ts
        │   └── useDashboard.ts
        ├── components/
        │   ├── ui/                ← Button, Card, Badge, Input
        │   ├── layout/            ← Sidebar, Layout
        │   ├── dashboard/         ← KPICards, PerformanceChart
        │   └── campaigns/         ← CampaignTable, MiniFunnel
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx
            ├── Campaigns.tsx
            ├── Creatives.tsx
            ├── Audiences.tsx
            ├── Rules.tsx
            ├── Integrations.tsx
            └── Profiles.tsx
```

---

## Como Rodar

### Pré-requisitos
- Docker + Docker Compose
- Node.js 20+ (para dev local)

### 1. Clonar e configurar

```bash
git clone <repo>
cd ORUS
cp .env.example .env
# Edite .env com seus valores
```

### 2. Docker Compose (recomendado)

```bash
docker compose up -d
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Prisma Studio: `docker exec -it orus_backend npx prisma studio`

### 3. Dev Local (sem Docker)

```bash
# Terminal 1 — PostgreSQL e Redis (via Docker)
docker compose up postgres redis -d

# Terminal 2 — Backend
cd backend
npm install
cp ../.env.example .env   # ajuste DATABASE_URL para localhost
npx prisma migrate dev --name init
npm run dev

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

---

## Rastreamento do Site (Script JS)

O ORUS oferece um script de rastreamento real que funciona mesmo com cloakers.

### 1. Gere uma Tracking Key
Na plataforma: **Integrações → Tracking Keys → Gerar Key**

### 2. Adicione o script no seu site

```html
<script src="https://seu-backend.com/api/tracking/script/SUA_TRACKING_KEY.js"></script>
```

### 3. Dispare eventos

```javascript
// Cadastro realizado
orus.lead({ email: "usuario@email.com" });

// Compra realizada
orus.purchase({ value: 97.00, email: "usuario@email.com" });

// Evento customizado
orus.custom({ action: "checkout_init" });
```

### Como o cloaker é suportado

O script:
1. Captura os parâmetros UTM/BM da URL inicial (`?bm=123&utm_campaign=xxx&creative_id=yyy`)
2. **Persiste no `localStorage`** — sobrevive a redirects do cloaker
3. Ao disparar um evento (lead/purchase), reenvia todos os parâmetros capturados
4. Gera fingerprint leve do dispositivo para deduplicação

---

## Funcionalidades

### Multi-Perfil
- Cada usuário cria múltiplos **Perfis** (marcas/projetos)
- Cada perfil tem integações, campanhas e dados completamente isolados
- Selector de perfil na sidebar

### Dashboard
- KPIs: Faturamento, Gasto, ROAS, Vendas, Leads, CPA
- Gráfico de Performance por Dia (Gasto × Faturamento × Leads)
- Seletor de período: Hoje / 7d / 14d / 30d

### Gerenciador de Anúncios
- Tabela com campanhas, métricas e status
- **Mini Funil** por campanha: Cliques → Leads plataforma → Cadastros Reais → Compras Reais
- Comparação entre dados do gerenciador e conversões reais rastreadas

### Análise de Criativos
- Cards visuais com preview, ROAS, CTR, CPA, Vendas
- Ordenação: Melhor ROAS, Melhor CTR, Menor CPA, Mais Vendas

### Audiências
- Criação com filtros avançados (tipo de evento, janela de dias, campanha do site)
- Exportação CSV da lista de usuários

### Automações
- Regras baseadas em métricas reais (ROAS, CPA, Leads, CTR, Gasto)
- Ações: Pausar campanha/conjunto, Aumentar/Reduzir orçamento, Alertas
- Toggle de ativar/pausar por regra

### Integrações
- Meta Ads (BMS), TikTok, Kwai, Google Ads, GA4, WhatsApp/CRM
- Tokens salvos criptografados (AES-256-GCM)
- Geração e gerenciamento de Tracking Keys

---

## Endpoints da API

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/profiles
POST   /api/profiles
GET    /api/profiles/:id
PATCH  /api/profiles/:id
DELETE /api/profiles/:id

GET    /api/dashboard/:profileId?from=&to=

GET    /api/campaigns/profile/:profileId?from=&to=&level=
GET    /api/campaigns/:id/funnel

GET    /api/integrations/profile/:profileId
POST   /api/integrations/profile/:profileId
DELETE /api/integrations/:id
GET    /api/integrations/profile/:profileId/tracking-keys
POST   /api/integrations/profile/:profileId/tracking-keys

GET    /api/audiences/profile/:profileId
POST   /api/audiences/profile/:profileId
GET    /api/audiences/:id/export

GET    /api/rules/profile/:profileId
POST   /api/rules/profile/:profileId
PATCH  /api/rules/:id/toggle
DELETE /api/rules/:id

POST   /api/tracking/conversion     ← Recebe eventos do script JS (CORS *)
GET    /api/tracking/script/:key.js ← Serve o script personalizado
```

---

## Variáveis de Ambiente

| Variável          | Descrição                                     |
|-------------------|-----------------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string                  |
| `REDIS_URL`       | Redis connection string                       |
| `JWT_SECRET`      | Segredo para assinar JWTs (mín. 32 chars)     |
| `JWT_EXPIRES_IN`  | Expiração do token (ex: `7d`)                 |
| `ENCRYPTION_KEY`  | Chave para criptografar tokens de integração  |
| `FRONTEND_URL`    | URL do frontend (CORS)                        |
| `VITE_API_URL`    | URL do backend (usado pelo frontend)          |

---

## Próximos Passos

- [ ] Sync automático com API do Meta Ads (Graph API)
- [ ] Sync com TikTok Ads API
- [ ] Integração real com GA4 Measurement Protocol
- [ ] Job cron para execução das regras de automação
- [ ] Notificações (email / webhook) para alertas de regras
- [ ] Painel de conversões em tempo real (WebSocket)
- [ ] Relatórios exportáveis (PDF/XLSX)
- [ ] Mobile-responsive completo

---

*ORUS — Feito para media buyers que não aceitam dados incompletos.*
