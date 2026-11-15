# AQUI NET HELP

Plateforme SaaS internationale d'analyse et d'optimisation des comptes TikTok, Facebook, Instagram et YouTube.

## Objectif produit
Aider les créateurs, indépendants et entreprises à comprendre leurs performances sociales, identifier les freins à leur croissance et appliquer un plan d'amélioration concret.

## Stack
- React + TypeScript + Vite
- Cloudflare Workers
- Supabase Auth + PostgreSQL + RLS
- Intégrations officielles TikTok et Meta, sous réserve des autorisations et validations de chaque plateforme
- Paiement actuellement préparé en XOF via CinetPay

## Accès et quota
- Un compte par adresse e-mail (unicité gérée par Supabase Auth).
- Trois analyses gratuites par compte.
- Au-delà, un abonnement actif est requis.
- L'accès payant est accordé uniquement après confirmation du paiement côté serveur.

## Réseaux et fiabilité des données
- TikTok : statistiques importées selon les autorisations de l'API officielle.
- Facebook : Pages administrées et statistiques autorisées par Meta.
- Instagram et YouTube : saisie assistée des métriques visibles par le propriétaire, tant que les accès API dédiés ne sont pas activés.
- Les métriques déclarées manuellement sont signalées comme non vérifiées par la plateforme.

## Monétisation
- Abonnements.
- Emplacements publicitaires gérés par l'administrateur.
- Campagnes publicitaires en libre-service.
- Affiliation et partenariats, sous réserve de liens et contrats valides.
- AdSense uniquement après validation du site par Google.
- Contributions volontaires au projet.

## Développement
- `npm install`
- `npm run build`
- `npm run deploy`

## Sécurité
- Les clés privées restent dans les secrets Cloudflare.
- La clé Supabase service role n'est jamais exposée au navigateur.
- Les abonnements ne sont activés qu'après vérification serveur des transactions.
- Les quotas sont appliqués atomiquement en base de données.

Les revenus et les performances de croissance ne sont pas garantis. Les accès aux données dépendent des API, des autorisations et des règles des plateformes.
