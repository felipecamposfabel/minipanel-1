# MiniPanel

A dashboard application built with Next.js 14 (App Router) and Express, backed by PostgreSQL via local Supabase.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Supabase running on Docker** at `localhost:54322` — start with `supabase start` in your Supabase project directory

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd minipanel

# 2. Install dependencies
npm install

# 3. Start development servers
npm run dev
```

`npm run dev` starts both:
- **Express API** at [http://localhost:3001](http://localhost:3001)
- **Next.js frontend** at [http://localhost:3000](http://localhost:3000)

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both Express and Next.js in development mode |
| `npm run build` | Build Next.js for production |
| `npm run type-check` | Run TypeScript type checking |
| `npm test` | Run backend unit tests with Vitest |
| `npm run test:e2e` | Run end-to-end tests with Playwright |
