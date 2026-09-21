# Steam Hours Tracker

Rastreia quantas horas você jogou cada jogo da Steam, por dia, e mostra numa página.

## Como funciona

Uma vez por dia (23:55, horário de Brasília), um cron job da Vercel busca seu
tempo total jogado em cada jogo na Steam Web API e compara com o snapshot do
dia anterior. A diferença vira "horas jogadas hoje" para cada jogo. Também dá
pra forçar essa atualização a qualquer momento clicando em "Atualizar agora"
na página.

## Setup

### 1. Steam API key e SteamID64

- Gere uma key em https://steamcommunity.com/dev/apikey
- Pegue seu SteamID64 (ex: via https://steamid.io/)
- Nas configurações de privacidade da Steam, deixe "Detalhes do jogo" como
  Público — sem isso a API não retorna tempo jogado, mesmo usando sua própria
  key.

### 2. Upstash Redis

No dashboard da Vercel, adicione a integração Upstash Redis (Marketplace) ao
projeto. Isso preenche `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`
automaticamente nas env vars do projeto.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` para rodar localmente, preenchendo
`STEAM_API_KEY`, `STEAM_ID64` e um `CRON_SECRET` (qualquer string aleatória).
Na Vercel, adicione as mesmas três variáveis em Project Settings → Environment
Variables (as duas do Upstash já vêm da integração).

### 4. Deploy

```bash
npm install
vercel --prod
```

O cron configurado em `vercel.json` já entra em ação automaticamente após o
deploy.

### 5. Testar

- Localmente: `npm run dev`, clique em "Atualizar agora" (vai dar erro sem as
  env vars reais preenchidas em `.env.local`).
- Em produção: abra a página publicada e clique em "Atualizar agora", ou
  dispare o cron manualmente:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-APP.vercel.app/api/cron/poll
```

## Rodando os testes

```bash
npm test
```
