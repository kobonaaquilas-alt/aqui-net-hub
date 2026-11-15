# AQUI NET HUB — configuration de production

## 1. Base de données Supabase

Dans Supabase > SQL Editor, exécuter les migrations dans cet ordre, une seule fois chacune :

1. `supabase/migrations/20261106_hub_features.sql` — comptes, synchronisation, demandes ADS/Partners, campagnes, formules et commandes.
2. `supabase/migrations/20261106_hub_entitlements.sql` — abonnements et fonction de confirmation atomique des paiements.
3. `supabase/migrations/20261106000100_hub_plan_snapshot.sql` — conserve le nom et la durée de la formule au moment de la commande et sécurise l’extension des abonnements.
4. `supabase/migrations/20261110000100_facebook_oauth.sql` et `supabase/migrations/20261110000200_facebook_service_role_grants.sql` — connexion Facebook OAuth et stockage des jetons côté serveur.
5. Les migrations suivantes ajoutent les jobs vidéo, l’audit social, TikTok OAuth, l’essai publicitaire, l’automatisation navigateur et les durcissements de sécurité : consulter `supabase/migrations/` et appliquer les fichiers dans l’ordre chronologique sur une nouvelle base. La base de production actuelle a reçu les migrations jusqu’au 15 novembre 2026, notamment `20261115000100_harden_payment_orders_and_tiktok_state_index.sql`, `20261115000200_least_privilege_public_table_grants.sql` et `20261115000300_add_aqui_net_ads_event_analytics.sql`.

La troisième migration dépend des deux premières. Elle protège les commandes déjà initiées si une formule est ensuite désactivée ou modifiée.

## 2. Authentification Supabase

Dans Supabase > Authentication > URL Configuration :

- Définir le Site URL sur `https://aqui-net-hub.kobonaaquilas.workers.dev`.
- Ajouter `https://aqui-net-hub.kobonaaquilas.workers.dev/**` aux Redirect URLs autorisées pour les liens de confirmation et de réinitialisation du mot de passe.

## 3. Secrets Cloudflare Worker

Dans Cloudflare > Workers & Pages > aqui-net-hub > Settings > Variables and Secrets, créer les variables suivantes. Les clés privées doivent être de type **Secret**, pas du texte public.

| Nom exact | Type | Valeur |
|---|---|---|
| `SUPABASE_URL` | Secret | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Secret | Clé publishable/anon du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Clé service_role du projet Supabase |
| `CINETPAY_API_KEY` | Secret | Clé API du compte marchand CinetPay |
| `CINETPAY_API_PASSWORD` | Secret | Mot de passe API du compte marchand CinetPay |
| `APP_BASE_URL` | Variable texte | `https://aqui-net-hub.kobonaaquilas.workers.dev` |
| `MAGIC_HOUR_API_KEY` | Secret | Clé API Magic Hour pour la génération vidéo principale |
| `TIKTOK_CLIENT_KEY` | Secret | Client Key de l’application TikTok for Developers |
| `TIKTOK_CLIENT_SECRET` | Secret | Client Secret de l’application TikTok for Developers |
| `GITHUB_TOKEN` | Secret | Jeton GitHub limité aux Actions nécessaires à l’automatisation navigateur |
| `FAL_KEY` | Secret facultatif | Clé fal.ai uniquement si le moteur de secours payant est activé |
| `VIDEO_ALLOW_PAID_FALLBACK` | Variable texte facultative | Mettre `true` uniquement si tu acceptes l’utilisation payante du moteur fal.ai |

Ne jamais placer la clé `service_role` ou les identifiants CinetPay dans le code frontend, dans GitHub ou dans une conversation. Ne pas les transmettre à une autre personne.

## 4. Connexion Facebook (Meta Graph API)

Dans Meta for Developers, créer une application de type Business, ajouter Facebook Login et configurer l'URL OAuth de redirection autorisée exactement comme suit :

`https://aqui-net-hub.kobonaaquilas.workers.dev/api/facebook/callback`

Activer le mode Live et demander uniquement les autorisations nécessaires à l'analyse des Pages : `pages_show_list`, `pages_read_engagement` et `read_insights`. Pour les utilisateurs qui ne sont pas rôles de l'application, Meta peut exiger la vérification de l'entreprise et l'App Review / Advanced Access avant la mise en production.

Dans Cloudflare > Workers & Pages > aqui-net-hub > Settings > Variables and Secrets, ajouter ces secrets :

| Nom exact | Type | Valeur |
|---|---|---|
| `FACEBOOK_APP_ID` | Secret ou variable | App ID de l'application Meta |
| `FACEBOOK_APP_SECRET` | Secret | App Secret de l'application Meta |
| `FACEBOOK_GRAPH_VERSION` | Variable texte | `v26.0` |

Ne jamais mettre l'App Secret ni les jetons Facebook dans le frontend, GitHub ou une page publique. Les jetons de Pages sont conservés dans des tables Supabase protégées par RLS et accessibles uniquement par le Worker avec la clé serveur.

Après configuration, le parcours utilisateur est : connexion à AQUI NET HUB > « Connecter Facebook » > autorisation Meta > choix d'une Page administrée > analyse automatique. Un lien Facebook seul ne donne pas accès aux statistiques privées. Les comptes personnels ne fournissent pas les mêmes statistiques que les Pages ; l'intégration analyse les Pages autorisées par Meta.

## 5. Connexion TikTok

Dans TikTok for Developers, activer Login Kit et le produit Display API. Configurer l’URL de redirection OAuth :

`https://aqui-net-hub.kobonaaquilas.workers.dev/api/tiktok/callback`

Scopes demandés : `user.info.basic`, `user.info.profile`, `user.info.stats` et `video.list`. Les scopes doivent être approuvés pour l’application, puis chaque utilisateur doit autoriser explicitement la connexion. La récupération du profil, des statistiques et des vidéos reste limitée aux données accordées par TikTok.

## 6. AQUI VIDEO AI

- Fournisseur principal : Magic Hour, avec génération texte-vers-vidéo et image-vers-vidéo.
- Une clé API Magic Hour peut être créée depuis https://magichour.ai/developer. La FAQ du fournisseur annonce 400 crédits à l’inscription sans carte bancaire ; ces crédits sont limités et ne constituent pas une offre gratuite illimitée.
- Important : selon la FAQ Magic Hour, les vidéos créées sans abonnement, achat de crédits ou facturation payante autorisée sont réservées à un usage personnel et non commercial. Ne pas les utiliser pour des campagnes commerciales.
- L’image est téléversée directement depuis l’appareil ; elle n’a pas besoin d’une URL publique.
- Interface actuelle : 2, 5, 10 ou 15 secondes. Les clips de 2 secondes sont prévus sans abonnement ; les durées supérieures nécessitent un abonnement actif.
- fal.ai est un secours facultatif payant : ne définir `VIDEO_ALLOW_PAID_FALLBACK=true` que si tu acceptes ces coûts.
- Un test de génération réel doit être effectué après configuration de la clé Magic Hour et vérification des crédits du compte fournisseur. Ne pas lancer un test payant sans vérifier les tarifs.

## 7. Formules

La base de production contient actuellement des formules à 500 FCFA et 5 000 FCFA. Le responsable doit confirmer que ces tarifs correspondent bien à l’offre commerciale avant d’encaisser des paiements. Les prix actifs sont lus depuis `public.hub_plans`, jamais depuis le navigateur.

## 8. Vérifications et paiement

- Ouvrir `/api/health` sur le domaine de production : `ok` doit être `true`. Les indicateurs Supabase et CinetPay signalent seulement la présence des variables, pas la validité des identifiants.
- L’espace membre affiche les abonnements et les cinq derniers paiements à partir de données serveur filtrées sur l’utilisateur connecté.
- AQUI NET ADS comptabilise les impressions et clics par campagne et affiche le CTR. Les chiffres sont indicatifs et peuvent inclure les visites répétées.
- Le Worker expire les abonnements échus et nettoie les états OAuth Facebook et TikTok expirés chaque heure.
- Effectuer les premiers essais uniquement avec les identifiants Sandbox CinetPay.
- Configurer `https://aqui-net-hub.kobonaaquilas.workers.dev/api/payments/webhook` comme URL de notification du compte marchand.
- Vérifier le statut auprès de CinetPay côté serveur avant de valider une commande. Le retour du navigateur ne constitue jamais une preuve de paiement.

Les transactions réelles nécessitent un compte marchand vérifié et administré par son titulaire adulte.

## 9. Publication Android

Le workflow GitHub Actions produit un APK de test et un App Bundle. Pour produire un App Bundle signé destiné à Google Play, créer une clé de signature Android et enregistrer ces quatre secrets dans GitHub > Settings > Secrets and variables > Actions :

- `ANDROID_KEYSTORE_BASE64` : fichier keystore encodé en Base64.
- `ANDROID_KEYSTORE_PASSWORD` : mot de passe du keystore.
- `ANDROID_KEY_ALIAS` : alias de la clé.
- `ANDROID_KEY_PASSWORD` : mot de passe de la clé.

Sans ces quatre secrets, l’APK de test est généré, mais le bundle de publication reste non signé. Conserver une sauvegarde sécurisée du keystore : sa perte peut empêcher les mises à jour de l’application.

