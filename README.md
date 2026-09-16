## Local full-stack setup

Run PostgreSQL, Redis, the API, and the worker from `../constDocManagment` with Docker Compose. The API is published on `http://localhost:3001`; Next.js runs on `http://localhost:3000`.

Copy `.env.local.example` to `.env.local`, then start the frontend:

```powershell
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

Start the backend in another terminal:

```powershell
Set-Location ..\constDocManagment
Copy-Item .env.example .env
# Fill DB_USER, DB_PASS, JWT_SECRET, and JWT_REFRESH_SECRET in .env.
docker compose up --build
```

Verify the services before opening the frontend:

```powershell
Invoke-WebRequest http://localhost:3001/health
Invoke-WebRequest http://localhost:3001/health/ready
```

Use `docker compose down` to stop the stack. Named volumes preserve database, Redis, and local document data.

## Testing

Run frontend tests with `npm test`. Run backend API smoke tests from `../constDocManagment` with `test\run-tests.bat`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
