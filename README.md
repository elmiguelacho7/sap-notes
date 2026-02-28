This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## SAP Notes Hub — Project overview

This app is the **SAP Notes Hub** (Project Hub): an internal environment for notes, projects, tickets, and an AI assistant.

### Supabase — Row Level Security (development)

For development, the Supabase table `public.tickets` uses a very permissive RLS setup:

- **RLS is enabled** on `public.tickets`.
- Policy **"Tickets full access (dev)"** allows all operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) for role `public`, with `USING (true)` and `WITH CHECK (true)`.

This was done to avoid error code **42501** (row-level security violation) when inserting tickets from the frontend (anon key). **This configuration must be restricted for production** (e.g. scope policies by user/session or service role).

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
