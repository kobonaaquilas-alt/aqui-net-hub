# AQUI NET HUB — configuration de production

## 1. Base de données Supabase

Dans Supabase > SQL Editor, exécuter les migrations dans cet ordre, une seule fois chacune :

1. `supabase/migrations/20261106_hub_features.sql` — comptes, synchronisation, demandes ADS/Partners, campagnes, formules et commandes.
2. `supabase/migrations/20261106_hub_entitlements.sql` — abonnements et fonction de confirmation atomique des paiements.
3. `supabase/migrations/20261106000100_hub_plan_snapshot.sql` — conserve le nom et la durée de la formule au moment de la commande et sécurise l’extension des abonnements.
4. `supabase/migrations/20261110000100_facebook_oauth.sql` et `supabase/migrations/20261110000200_facebook_service_role_grants.sql` — connexion Facebook OAuth et stockage des jetons côté serveur.

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

## 5. Formules

Ajouter les formules et leurs prix exacts dans `public.hub_plans` depuis Supabase, puis mettre `is_active = true`. Aucun tarif n'est prérempli : le montant doit correspondre à l'offre réellement décidée et publiée par le responsable du service.

## 6. Vérifications et paiement

- Ouvrir `/api/health` sur le domaine de production : `ok` doit être `true`. Les indicateurs Supabase et CinetPay signalent seulement la présence des variables, pas la validité des identifiants.
- L’espace membre affiche maintenant les abonnements et les cinq derniers paiements à partir de données serveur filtrées sur l’utilisateur connecté.
- Effectuer les premiers essais uniquement avec les identifiants Sandbox CinetPay.
- Configurer `https://aqui-net-hub.kobonaaquilas.workers.dev/api/payments/webhook` comme URL de notification du compte marchand.
- Vérifier le statut auprès de CinetPay côté serveur avant de valider une commande. Le retour du navigateur ne constitue jamais une preuve de paiement.

Les transactions réelles nécessitent un compte marchand vérifié et administré par son titulaire adulte.
