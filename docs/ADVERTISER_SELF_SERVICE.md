# AQUI NET ADS — campagnes en libre-service

## Fonctionnement
- Un utilisateur connecté peut créer ses propres campagnes depuis l'espace **Partenariats / AQUI NET ADS**.
- La première campagne déclenche un essai gratuit de 3 jours, une seule fois par compte.
- L'essai n'entraîne aucun prélèvement automatique. À son expiration, les campagnes ne sont plus affichées publiquement tant qu'un abonnement valide n'est pas confirmé.
- Un abonnement actif prolonge les campagnes jusqu'à sa date de fin.
- L'annonceur peut consulter ses campagnes, les mettre en pause, les réactiver ou les supprimer.
- Les campagnes administrées directement par le propriétaire du site restent compatibles avec le panneau d'administration.

## Contrôles
- Authentification Supabase vérifiée côté Worker.
- Écritures effectuées avec la clé de service uniquement côté Worker.
- Les URL de destination et d'image doivent être HTTPS et publiques.
- Limites de longueur sur le titre et la description.
- Confirmation obligatoire par l'annonceur qu'il possède les droits sur le contenu et qu'il respecte la loi et les règles de la plateforme.
- Les campagnes expirées sont filtrées de l'affichage public à partir de leur date de fin.
- Le webhook CinetPay prolonge les campagnes uniquement après confirmation serveur du paiement.

## Données Supabase
- `hub_campaigns` : champs `owner_user_id`, `trial_started_at` et `is_self_service`.
- `hub_advertiser_trials` : une ligne par utilisateur, avec les dates de début et de fin de l'essai.
- `confirm_hub_payment(uuid, text)` : confirme l'ordre de paiement et prolonge les campagnes de l'utilisateur.

## Routes Worker
- `GET /api/ads/campaigns` : liste les campagnes du compte et l'état de l'essai.
- `POST /api/ads/campaigns` : crée une campagne.
- `PATCH /api/ads/campaigns/:id` : met en pause ou réactive une campagne.
- `DELETE /api/ads/campaigns/:id` : supprime une campagne.
- `GET /api/public/campaigns` : expose uniquement les campagnes actives et non expirées.

## Configuration externe encore requise
- Les secrets CinetPay doivent être configurés dans les secrets Cloudflare pour accepter les paiements réels.
- Le compte marchand CinetPay doit être validé pour le Togo et le mode de paiement choisi.
- Les abonnements et campagnes ne doivent jamais être marqués payés depuis le navigateur.
