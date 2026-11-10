# AQUI NET HUB

Plateforme numérique pour découvrir des outils, apprendre, structurer des projets et accéder à un espace membre.

## Technologies
- React 19 + TypeScript
- Vite 6
- Cloudflare Workers
- Supabase Auth et PostgreSQL
- CinetPay JS SDK pour les paiements côté serveur

## Fonctionnalités présentes
- Catalogue d'outils avec recherche, catégories et favoris
- NET ASSIST et parcours AQUI NET ACADEMY
- Espace membre avec création de compte et connexion Supabase
- Synchronisation des favoris et de la progression entre appareils
- Formulaires de demandes AQUI NET ADS et AQUI NET PARTNERS
- Affichage des campagnes et formules actives publiées dans Supabase
- Initialisation de paiement côté serveur et réception de notifications CinetPay
- Création d'un abonnement après confirmation serveur du paiement

## Démarrage local
1. Installer Node.js (version LTS).
2. Exécuter `npm install`.
3. Exécuter `npm run dev`.

## Compilation et déploiement
- Vérification : `npm run build`
- Déploiement : `npm run deploy`

## Configuration de production
Consulter [docs/CONFIGURATION_PRODUCTION.md](docs/CONFIGURATION_PRODUCTION.md) pour l'ordre des migrations Supabase, les variables Cloudflare et les étapes de vérification.

## Automatisation navigateur\n- Automatisation navigateur en lecture seule dans l'espace administrateur, exécuté par GitHub Actions + Playwright et stocké dans Supabase.\n- Détails : [docs/BROWSER_AUTOMATION.md](docs/BROWSER_AUTOMATION.md).\n\n## Sécurité
- Les clés privées et identifiants de paiement restent exclusivement dans les secrets Cloudflare.
- La clé Supabase `service_role` ne doit jamais être exposée au navigateur.
- Les paiements ne sont considérés comme réussis qu'après vérification côté serveur auprès de CinetPay.
- Les prix proviennent des formules actives en base de données, jamais du montant envoyé par le navigateur.
- Les paiements réels nécessitent un compte marchand vérifié et administré par son titulaire adulte.

Aucun revenu ni résultat commercial n'est garanti.
