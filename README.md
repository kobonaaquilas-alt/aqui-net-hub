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
- AQUI NET ADS en libre-service : création, pause, réactivation et suppression de campagnes
- Essai publicitaire gratuit de 3 jours, une seule fois par compte, sans prélèvement automatique
- Prolongation des campagnes après confirmation d'un abonnement CinetPay
- Formulaires complémentaires de demandes AQUI NET ADS et AQUI NET PARTNERS
- Affichage public des campagnes actives et non expirées
- AQUI VIDEO AI : génération à partir d'une image, 2 secondes gratuites et durées payantes de 15 à 60 secondes
- AQUI SOCIAL AUDIT : 3 diagnostics gratuits et connexion Facebook officielle lorsque les autorisations Meta sont configurées
- Initialisation de paiement côté serveur et réception de notifications CinetPay
- Création d'un abonnement uniquement après confirmation serveur du paiement
- Surveillance de disponibilité et de déploiement via GitHub Actions

## Démarrage local
1. Installer Node.js (version LTS).
2. Exécuter `npm install`.
3. Exécuter `npm run dev`.

## Compilation et déploiement
- Vérification : `npm run build`
- Déploiement : `npm run deploy`

## Configuration de production
Consulter [docs/CONFIGURATION_PRODUCTION.md](docs/CONFIGURATION_PRODUCTION.md) pour l'ordre des migrations Supabase, les variables Cloudflare et les étapes de vérification.

## Automatisation navigateur
- Automatisation navigateur en lecture seule dans l'espace administrateur, exécutée par GitHub Actions + Playwright et stockée dans Supabase.
- Détails : [docs/BROWSER_AUTOMATION.md](docs/BROWSER_AUTOMATION.md).

## Sécurité
- Les clés privées et identifiants de paiement restent exclusivement dans les secrets Cloudflare.
- La clé Supabase `service_role` ne doit jamais être exposée au navigateur.
- Les paiements ne sont considérés comme réussis qu'après vérification côté serveur auprès de CinetPay.
- Les prix proviennent des formules actives en base de données, jamais du montant envoyé par le navigateur.
- Les paiements réels nécessitent un compte marchand vérifié et administré par son titulaire adulte.

Aucun revenu ni résultat commercial n'est garanti.
