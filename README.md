# PrestaLink

La marketplace sécurisée pour les services locaux au Cameroun.

## Stack technique

- **Frontend** : React + TypeScript + Vite
- **UI** : Tailwind CSS + shadcn/ui
- **Backend** : Supabase (Auth, Database, Storage, Edge Functions)
- **Paiement** : FreemoPay
- **IA** : OpenAI GPT-4o (vérification d'identité)
- **Hébergement** : Vercel

## Variables d'environnement

Créer un fichier `.env` à la racine :

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Variables Supabase Edge Functions

Dans le dashboard Supabase > Edge Functions > Secrets :

```
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

## Déploiement sur Vercel

1. Push le code sur GitHub
2. Importer le repo sur [vercel.com](https://vercel.com)
3. Ajouter les variables d'environnement dans Vercel :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Déployer

## Après déploiement

Remplacer `YOUR_VERCEL_URL.vercel.app` par ton vrai domaine dans :
- `src/pages/Index.tsx`
- `src/pages/PublicProfile.tsx`

## Dev local

```bash
npm install
npm run dev
```
