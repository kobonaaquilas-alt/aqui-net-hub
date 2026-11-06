# AQUI NET HUB — configuration de production
1. Dans Supabase > SQL Editor, exécuter une seule fois `supabase/migrations/20261106_hub_features.sql`. La migration ajoute des tables `hub_*` et ne modifie pas les tables existantes.
2. Dans Cloudflare Workers > aqui-net-hub > Settings > Variables and Secrets, ajouter les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CINETPAY_API_KEY`, `CINETPAY_API_PASSWORD`. Définir aussi `APP_BASE_URL=https://aqui-net-hub.kobonaaquilas.workers.dev`.
3. Ne jamais placer la clé service_role ou les identifiants CinetPay dans le code navigateur, GitHub ou une conversation.
4. Ajouter les formules et leurs prix exacts dans `hub_plans` depuis Supabase, puis activer `is_active`. Aucun prix n'est inventé ou prérempli.
5. Vérifier `/api/health`, tester d'abord avec le mode Sandbox, puis configurer `/api/payments/webhook` comme URL de notification dans le compte marchand.
6. Les transactions réelles nécessitent un compte marchand vérifié et administré par son titulaire adulte.
