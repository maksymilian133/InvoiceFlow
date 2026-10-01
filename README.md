# InvoiceFlow

> Projekt zbudowany przy użyciu AI jako narzędzia wspomagającego development

Automatyczny pipeline do przetwarzania faktur z lokalnym LLM ([Ollama](https://ollama.com)).

Wgrywasz fakturę (PDF lub TXT) → AI wyciąga dane → system waliduje NIPy i kwoty → faktura trafia do ERP.

## Stack

Node.js · Express 5 · TypeScript · BullMQ · Redis · PostgreSQL · Ollama · React · Docker

## Uruchomienie

```bash
cp .env.example .env.docker
# Ustaw OLLAMA_URL i OWN_NIP w .env.docker

ollama pull qwen2.5:7b
docker compose up --build
```

| Serwis   | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| API      | http://localhost:3000 |
| ERP Mock | http://localhost:3001 |

### Dev (lokalnie)

```bash
npm install && npm install --prefix frontend
cp .env.example .env
npm run dev
```

Wymaga lokalnego PostgreSQL i Redis.

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env` i uzupełnij wymagane pola.

| Zmienna         | Opis                        | Domyślnie               |
|-----------------|-----------------------------|-------------------------|
| `PORT`          | Port API                    | `3000`                  |
| `DB_*`          | Połączenie PostgreSQL       | —                       |
| `REDIS_HOST/PORT` | Połączenie Redis          | `127.0.0.1:6379`        |
| `OLLAMA_URL`    | Adres serwera Ollama        | `http://localhost:11434` |
| `OLLAMA_MODEL`  | Nazwa modelu                | `qwen2.5:7b`            |
| `OWN_NIP`       | Twój NIP                    | —                       |
| `ERP_URL`       | Adres serwisu ERP           | `http://localhost:3001` |

## Statusy faktury

`pending` → `processing` → `done` / `needs_review` / `rejected`

## API

`GET /api/invoices` · `GET /api/invoices/:id` · `POST /api/invoices` · `PATCH /api/invoices/:id` · `POST /api/invoices/:id/approve` · `DELETE /api/invoices/:id`

WebSocket: `ws://localhost:3000/ws-app?id=<invoiceId|__global__>`

## ERP Mock

Uproszczony mock OData v4 trzymający dane w pamięci. Służy wyłącznie do testów lokalnych.
