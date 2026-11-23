# AQUI NET HUB

**Découvrez des outils numériques et d'intelligence artificielle pour apprendre, créer et développer vos projets.**

🌐 **Site officiel :** https://aqui-net-hub.kobonaaquilas.workers.dev/  
📰 **Blog et guides :** https://aqui-net-hub.blogspot.com/  
📚 **Guides pratiques :** https://aqui-net-hub.kobonaaquilas.workers.dev/guides

AQUI NET HUB est un hub de ressources numériques destiné aux jeunes, créateurs, étudiants et entrepreneurs, avec une attention particulière à l'Afrique francophone et un public international. Il aide à découvrir des outils, comparer leurs conditions d'accès et trouver des méthodes pratiques pour créer et développer une présence en ligne.

## Découvrir AQUI NET HUB

- [Catalogue de ressources numériques](https://aqui-net-hub.kobonaaquilas.workers.dev/)
- [Choisir un outil gratuit](https://aqui-net-hub.kobonaaquilas.workers.dev/guides/choisir-outil-gratuit)
- [Créer une vidéo courte avec un téléphone](https://aqui-net-hub.kobonaaquilas.workers.dev/guides/video-courte-telephone)
- [Améliorer une photo](https://aqui-net-hub.kobonaaquilas.workers.dev/guides/ameliorer-photo)
- [Développer sa présence en ligne](https://aqui-net-hub.kobonaaquilas.workers.dev/guides/presence-en-ligne)
- [Utiliser les outils IA en sécurité](https://aqui-net-hub.kobonaaquilas.workers.dev/guides/securite-outils-ia)

Les ressources indiquent, lorsque vérifiées, les quotas, limites, restrictions, modèles de gratuité et conditions d'accès. Les conditions des outils externes peuvent évoluer et doivent être vérifiées avant utilisation.

## Présentation

AQUI NET HUB aide les utilisateurs à :
- découvrir des outils numériques et d'IA pour la création vidéo, image, contenu et productivité;
- trouver des ressources pour créer et améliorer des sites web;
- apprendre à développer une présence numérique;
- consulter des guides pratiques en français;
- mieux comprendre les conditions de gratuité, les limites et la sécurité des outils.

Le site évolue et ajoute des ressources et fonctionnalités. Aucun revenu ni résultat commercial n'est garanti.

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
- AQUI NET ADS en libre-service : création, pause, réactivation, suppression et statistiques d’impressions, de clics et de CTR
- Essai publicitaire gratuit de 3 jours, une seule fois par compte, sans prélèvement automatique
- Prolongation des campagnes après confirmation d'un abonnement CinetPay
- Formulaires complémentaires de demandes AQUI NET ADS et AQUI NET PARTNERS
- Affichage public des campagnes actives et non expirées
- AQUI VIDEO AI : téléversement direct d’une image ou prompt texte, clips de 2/5/10/15 secondes, Magic Hour en priorité et fal.ai facultatif
- AQUI SOCIAL AUDIT : 3 diagnostics gratuits, préremplissage depuis les statistiques TikTok et connexion Facebook officielle pour analyser les Pages autorisées par Meta
- Initialisation de paiement côté serveur et réception de notifications CinetPay
- Création d'un abonnement uniquement après confirmation serveur du paiement
- Surveillance de disponibilité et de déploiement via GitHub Actions
- Maintenance horaire : expiration des abonnements et nettoyage des états OAuth Facebook/TikTok
- Espace d’administration disponible via `/?admin=1`, protégé par la liste des administrateurs Supabase

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

## Catalogue et veille AQUI NET HUB

- Catalogue complémentaire : `src/data/weekly-veille.ts`.
- La section publique « Veille » présente les conditions de gratuité, les limites, les concurrents africains et les solutions de paiement à étudier.
- Chaque outil doit conserver URL officielle, modèle de gratuité, limites, inscription, accès géographique et date de vérification.
- Ne jamais présenter un essai temporaire comme gratuit permanent ; revalider quotas, conditions et accès au Togo avant publication.
- Les prestataires de paiement restent à étudier : aucune activation sans compte marchand validé et secrets configurés côté serveur.
