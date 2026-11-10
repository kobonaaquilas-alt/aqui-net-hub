# Automatisation navigateur AQUI NET HUB

Le moteur navigateur utilise GitHub Actions et Playwright Chromium. Il est déclenché depuis l'espace d'administration du site et conserve les résultats dans Supabase.

## Capacités actuelles

- Ouvrir une URL HTTPS publique.
- Lire le texte d'une page.
- Extraire le texte d'un sélecteur CSS.
- Ouvrir un lien HTML sélectionné (les boutons et formulaires ne sont pas activés).
- Capturer une page en PNG.
- Consulter l'état et le résultat de la tâche dans l'espace d'administration.

## Sécurité et limites

- Accès réservé aux comptes présents dans `hub_admin_users`.
- Une tâche active par administrateur.
- Maximum de 15 étapes, 5 secondes d'attente par étape.
- Les destinations privées, locales et les URL contenant des identifiants sont bloquées.
- Le moteur est conçu pour la consultation et la recherche en lecture seule. Il ne remplit pas de formulaires, ne soumet pas de commandes, n'effectue pas d'achats et ne publie pas de contenu.
- Les sessions de connexion aux sites tiers ne sont pas conservées entre les exécutions.
- GitHub Actions exécute le navigateur dans un runner temporaire ; ce n'est pas un service permanent.

## API interne

- `POST /api/browser/jobs` : crée une tâche.
- `GET /api/browser/jobs/{request_id}` : récupère son état et son résultat.

Exemple de corps JSON :

```json
{
  "target_url": "https://example.com",
  "steps": [
    { "action": "extract_text", "selector": "main" },
    { "action": "screenshot", "full_page": true }
  ]
}
```

Actions acceptées : `extract_text`, `click_link`, `wait` (0 à 5000 ms), `screenshot`.

Les tâches sont enregistrées dans `public.hub_browser_jobs`. Les résultats sont accessibles uniquement à l'utilisateur propriétaire et au service serveur.
