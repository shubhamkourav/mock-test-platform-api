# Mock Test Platform API

REST API for a Testbook/Oliveboard-style exam preparation platform.

## Stack

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT access/refresh authentication
- Zod validation
- Swagger/OpenAPI
- Vitest + Supertest
- Docker
- GitHub Actions

## Domain

`Exam -> Sections -> Questions -> Tests -> Attempts -> Attempt Answers -> Results`

The SQL reference workbook was redesigned for MongoDB rather than copied table-for-table. Questions are reusable, tests contain ordered question mappings, and attempt answers remain separate because they can grow very large.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

API: http://localhost:5000/api/v1

Swagger: http://localhost:5000/docs

Health: http://localhost:5000/health

## Seed

```bash
npm run seed
```

The seed creates an admin, a student, IBPS PO, sections, questions and a sample mock.

Demo admin:
- email: admin@mocktest.local
- password: Admin@12345

Demo student:
- email: student@mocktest.local
- password: Student@12345

Change these credentials immediately outside local development.

## Main endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/exams`
- `POST /api/v1/exams` (admin)
- `GET /api/v1/exams/:id/sections`
- `POST /api/v1/questions` (admin)
- `GET /api/v1/questions`
- `POST /api/v1/tests` (admin)
- `GET /api/v1/tests`
- `GET /api/v1/tests/:id`
- `POST /api/v1/attempts`
- `GET /api/v1/attempts/:id`
- `POST /api/v1/attempts/:id/answers`
- `POST /api/v1/attempts/:id/submit`
- `GET /api/v1/attempts/:id/result`

## Production notes

- Put secrets in a secret manager.
- Use MongoDB replica sets in production.
- Add Redis for distributed rate limits/caching when traffic grows.
- Keep question snapshots/versioning for legally/audit-sensitive exam content.
- Never expose `correctOptions` while a student is taking a test.
