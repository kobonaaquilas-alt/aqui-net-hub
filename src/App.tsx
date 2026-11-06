
import { useEffect, useMemo, useState } from 'react';

type Language = 'fr' | 'en';
type Category = 'ai' | 'content' | 'productivity' | 'learning' | 'translation' | 'development' | 'marketing' | 'business';
type Tool = { name: string; category: Category; description: string; access: string; platforms: string; url: string };

const tools: Tool[] = [
  { name: 'ChatGPT', category: 'ai', description: 'Assistant IA pour rédiger, apprendre, analyser et créer.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://chatgpt.com/' },
  { name: 'Gemini', category: 'ai', description: 'Assistant IA de Google pour la recherche et la création.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://gemini.google.com/' },
  { name: 'Claude', category: 'ai', description: 'Assistant IA pour écrire, analyser et travailler.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://claude.ai/' },
  { name: 'Perplexity', category: 'ai', description: 'Recherche assistée par IA avec des réponses sourcées.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.perplexity.ai/' },
  { name: 'Microsoft Copilot', category: 'ai', description: 'Assistant IA pour les questions, la rédaction et la création.', access: 'Freemium', platforms: 'Web · Android · iOS · Windows', url: 'https://copilot.microsoft.com/' },
  { name: 'Canva', category: 'content', description: 'Création de visuels, présentations, affiches et contenus graphiques.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.canva.com/' },
  { name: 'CapCut', category: 'content', description: 'Montage vidéo et création de contenus pour les réseaux sociaux.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.capcut.com/' },
  { name: 'Photopea', category: 'content', description: 'Éditeur graphique en ligne pour retoucher des images.', access: 'Gratuit avec publicité', platforms: 'Web', url: 'https://www.photopea.com/' },
  { name: 'Adobe Express', category: 'content', description: 'Création de visuels, affiches, vidéos et publications.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.adobe.com/express/' },
  { name: 'OBS Studio', category: 'content', description: 'Enregistrement vidéo et diffusion en direct sur ordinateur.', access: 'Gratuit', platforms: 'Windows · macOS · Linux', url: 'https://obsproject.com/' },
  { name: 'Notion', category: 'productivity', description: 'Organisation du travail, notes et gestion de projets.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.notion.com/' },
  { name: 'Trello', category: 'productivity', description: 'Organisation des tâches et suivi des projets.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://trello.com/' },
  { name: 'Google Drive', category: 'productivity', description: 'Stockage, partage et organisation de fichiers en ligne.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://drive.google.com/' },
  { name: 'Khan Academy', category: 'learning', description: 'Cours et exercices pour apprendre gratuitement.', access: 'Gratuit', platforms: 'Web · Android · iOS', url: 'https://www.khanacademy.org/' },
  { name: 'freeCodeCamp', category: 'learning', description: 'Apprentissage gratuit de la programmation.', access: 'Gratuit', platforms: 'Web', url: 'https://www.freecodecamp.org/' },
  { name: 'Coursera', category: 'learning', description: 'Cours en ligne proposés par des universités et entreprises.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.coursera.org/' },
  { name: 'Duolingo', category: 'learning', description: 'Apprentissage des langues avec des exercices interactifs.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.duolingo.com/' },
  { name: 'DeepL', category: 'translation', description: 'Traduction de textes et de documents dans plusieurs langues.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.deepl.com/translator' },
  { name: 'GitHub Copilot', category: 'development', description: 'Assistant IA pour écrire, comprendre et améliorer du code.', access: 'Freemium', platforms: 'Web · IDE', url: 'https://github.com/features/copilot' },
  { name: 'Google Trends', category: 'marketing', description: 'Repérez les sujets recherchés et comparez les tendances.', access: 'Gratuit', platforms: 'Web', url: 'https://trends.google.com/trends/' },
  { name: 'Meta Business Suite', category: 'marketing', description: 'Gérez les publications, messages et statistiques de vos Pages Facebook et Instagram.', access: 'Gratuit', platforms: 'Web · Android · iOS', url: 'https://business.facebook.com/' },
  { name: 'TikTok Studio', category: 'marketing', description: 'Gérez vos contenus TikTok et consultez les statistiques de votre compte.', access: 'Gratuit', platforms: 'Web · Android', url: 'https://www.tiktok.com/tiktokstudio' },
  { name: 'Google Analytics', category: 'marketing', description: 'Mesurez la fréquentation de votre site et comprenez vos visiteurs.', access: 'Gratuit', platforms: 'Web', url: 'https://analytics.google.com/' },
  { name: 'Google Search Console', category: 'marketing', description: 'Suivez la présence de votre site dans Google et repérez les problèmes.', access: 'Gratuit', platforms: 'Web', url: 'https://search.google.com/search-console/about' },
  { name: 'WhatsApp Business', category: 'business', description: 'Présentez votre activité et échangez avec vos clients.', access: 'Gratuit au téléchargement', platforms: 'Android · iOS', url: 'https://www.whatsapp.com/business/' },
  { name: 'Systeme.io', category: 'business', description: 'Créez des pages de vente, tunnels, campagnes e-mail et formations.', access: 'Freemium', platforms: 'Web', url: 'https://systeme.io/' },
  { name: 'WooCommerce', category: 'business', description: 'Ajoutez une boutique en ligne à WordPress. Hébergement et services annexes payants.', access: 'Extension gratuite · coûts annexes', platforms: 'Web · WordPress', url: 'https://woocommerce.com/' }
];

const categories: { id: Category; fr: string; en: string; icon: string }[] = [
  { id: 'ai', fr: 'Intelligence artificielle', en: 'Artificial intelligence', icon: '✧' },
  { id: 'content', fr: 'Création de contenu', en: 'Content creation', icon: '▧' },
  { id: 'productivity', fr: 'Productivité', en: 'Productivity', icon: '◈' },
  { id: 'learning', fr: 'Formation', en: 'Learning', icon: '⌘' },
  { id: 'translation', fr: 'Traduction & langues', en: 'Translation & languages', icon: '文' },
  { id: 'development', fr: 'Développement', en: 'Development', icon: '{ }' },
  { id: 'marketing', fr: 'Marketing & visibilité', en: 'Marketing & visibility', icon: '↗' },
  { id: 'business', fr: 'Commerce & activité', en: 'Business & commerce', icon: '◇' }
];

const learningPaths = [
  {
    title: 'Créer du contenu numérique',
    description: 'Apprenez à concevoir des visuels, monter des vidéos et publier régulièrement.',
    steps: ['Découvrir Canva et CapCut', 'Créer trois contenus originaux', 'Apprendre les bases du montage', 'Analyser les résultats de ses publications'],
    category: 'content' as Category
  },
  {
    title: 'Maîtriser les outils IA',
    description: 'Utilisez les assistants IA pour rechercher, rédiger, apprendre et gagner du temps.',
    steps: ['Comprendre les possibilités et limites de l’IA', 'Apprendre à formuler des instructions précises', 'Vérifier les informations obtenues', 'Réaliser un petit projet avec un assistant IA'],
    category: 'ai' as Category
  },
  {
    title: 'Apprendre le développement web',
    description: 'Commencez par les bases avant de construire vos propres pages web.',
    steps: ['Découvrir HTML et CSS', 'Apprendre les bases de JavaScript', 'Créer une page personnelle', 'Publier un premier projet'],
    category: 'development' as Category
  },
  {
    title: 'Développer ses compétences professionnelles',
    description: 'Renforcez votre organisation, votre communication et votre autonomie numérique.',
    steps: ['Organiser son travail avec Notion ou Trello', 'Améliorer sa communication écrite', 'Créer un portfolio simple', 'Présenter clairement ses compétences'],
    category: 'productivity' as Category
  }
];

const businessSteps = [
  ['1. Trouver une idée utile', 'Identifiez un besoin réel autour de vous. Observez les difficultés des particuliers, commerçants et petites entreprises.'],
  ['2. Vérifier la demande', 'Interrogez des clients potentiels. Vérifiez qu’ils souhaitent réellement payer pour la solution proposée.'],
  ['3. Construire une offre simple', 'Définissez le service, le résultat attendu, le prix et les conditions de livraison.'],
  ['4. Être visible en ligne', 'Présentez votre activité sur WhatsApp Business et les réseaux sociaux. Publiez des exemples concrets de votre travail.'],
  ['5. Suivre les résultats', 'Notez les demandes, les ventes, les dépenses et les retours clients. Améliorez votre offre progressivement.']
];

const copy = {
  fr: {
    nav: ['Découvrir', 'NET ASSIST', 'Academy', 'Business', 'Ads & Partners'],
    eyebrow: 'LE HUB DU NUMÉRIQUE', title: 'Le bon outil numérique.', accent: 'Au bon moment.',
    intro: 'Découvrez des outils, comparez leurs possibilités et trouvez les ressources adaptées à vos projets.',
    search: 'Rechercher un outil ou un besoin…', searchBtn: 'Rechercher',
    hint: 'Des ressources numériques pour apprendre, créer et développer vos projets.',
    toolsEyebrow: 'AQUI NET TOOLS', toolsTitle: 'Explorez les outils numériques',
    all: 'Toutes les catégories', filter: 'Filtrer par catégorie', reset: 'Tout réinitialiser',
    results: 'outil(s) trouvé(s)', access: 'Accès', platforms: 'Plateformes', visit: 'Site officiel',
    empty: 'Aucun résultat. Essayez un autre mot-clé ou réinitialisez les filtres.',
    favorites: 'Mes favoris', addFavorite: 'Ajouter aux favoris', removeFavorite: 'Retirer des favoris',
    showAll: 'Tous les outils', showFavorites: 'Afficher uniquement mes favoris',
    assistEyebrow: 'VOTRE ASSISTANT D’ORIENTATION', assistTitle: 'Quel est votre objectif ?',
    assistText: 'Choisissez votre besoin : NET ASSIST vous propose une sélection d’outils adaptés.',
    choose: 'Sélectionnez un objectif',
    goals: ['Créer des vidéos et publications', 'Lancer une activité en ligne', 'Apprendre une compétence', 'Utiliser l’intelligence artificielle', 'Organiser mon travail', 'Créer un site ou une boutique'],
    recommend: 'Voir les outils recommandés', recommendation: 'Votre sélection recommandée',
    academyLabel: 'APPRENDRE ET PROGRESSER', academyTitle: 'AQUI NET ACADEMY',
    academyText: 'Des parcours pratiques pour développer vos compétences numériques, à votre rythme.',
    academyAction: 'Explorer les outils de formation',
    businessLabel: 'TRANSFORMER LES IDÉES EN PROJETS', businessTitle: 'AQUI NET BUSINESS',
    businessText: 'Des ressources pour structurer une activité, trouver des clients et développer une présence en ligne.',
    businessAction: 'Découvrir les outils business',
    footer: 'Découvrir. Créer. Progresser.', backTop: 'Retour en haut',
    pathsTitle: 'Des parcours pour passer à la pratique',
    pathsText: 'Chaque parcours propose des étapes simples. Avancez à votre rythme et réalisez des projets concrets.',
    startPath: 'Voir les outils utiles', progressTitle: 'Votre progression',
    businessRoadmap: 'Les étapes pour lancer une activité',
    businessWarning: 'Aucun revenu n’est garanti. Testez votre idée à petite échelle et évitez les dépenses que vous ne pouvez pas supporter.',
    adsTitle: 'AQUI NET ADS', adsText: 'Un espace destiné à présenter les possibilités de visibilité et de promotion sur AQUI NET HUB.',
    adsStatus: 'Espace en préparation', adsInfo: 'Les campagnes publicitaires, statistiques annonceurs et paiements ne sont pas encore activés sur cette plateforme.',
    partnersTitle: 'AQUI NET PARTNERS', partnersText: 'Un espace prévu pour les créateurs, formateurs, entreprises et partenaires qui souhaitent contribuer au hub.',
    partnersStatus: 'Partenariats en préparation', partnersInfo: 'Les inscriptions partenaires et le suivi automatisé des collaborations ne sont pas encore disponibles.',
    transparency: 'Transparence', transparencyText: 'Les espaces Ads et Partners sont présentés pour informer sur leur objectif. Aucun achat de publicité, paiement ou inscription partenaire ne peut être effectué depuis ces sections pour le moment.',
    privacyTitle: 'Données et confidentialité', privacyText: 'Les favoris sont enregistrés uniquement dans le stockage local de votre navigateur. Ils ne sont pas synchronisés entre appareils et aucun compte utilisateur n’est créé par cette fonctionnalité.',
    faqTitle: 'Questions fréquentes',
    faq: [
      ['Les outils présentés appartiennent-ils à AQUI NET HUB ?', 'Non. Ce sont des services externes. AQUI NET HUB les répertorie et renvoie vers leurs sites officiels.'],
      ['Les outils sont-ils tous gratuits ?', 'Non. Certains sont gratuits, d’autres proposent des fonctions payantes. Vérifiez toujours les conditions sur le site officiel.'],
      ['Mes favoris sont-ils accessibles sur un autre téléphone ?', 'Non. Ils sont conservés sur cet appareil et dans ce navigateur.'],
      ['Puis-je déjà acheter une publicité sur AQUI NET HUB ?', 'Non. L’espace Ads est en préparation. Les commandes et paiements publicitaires ne sont pas encore activés.']
    ]
  },
  en: {
    nav: ['Discover', 'NET ASSIST', 'Academy', 'Business', 'Ads & Partners'],
    eyebrow: 'THE DIGITAL HUB', title: 'The right digital tool.', accent: 'At the right time.',
    intro: 'Discover tools, compare their features and find resources suited to your projects.',
    search: 'Search for a tool or a need…', searchBtn: 'Search',
    hint: 'Digital resources to learn, create and grow your projects.',
    toolsEyebrow: 'AQUI NET TOOLS', toolsTitle: 'Explore digital tools',
    all: 'All categories', filter: 'Filter by category', reset: 'Reset all',
    results: 'tool(s) found', access: 'Access', platforms: 'Platforms', visit: 'Official website',
    empty: 'No results. Try another keyword or reset the filters.',
    favorites: 'My favorites', addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites',
    showAll: 'All tools', showFavorites: 'Show favorites only',
    assistEyebrow: 'YOUR DIGITAL GUIDE', assistTitle: 'What is your goal?',
    assistText: 'Choose what you need and NET ASSIST will suggest relevant tools.',
    choose: 'Select a goal',
    goals: ['Create videos and posts', 'Start an online business', 'Learn a skill', 'Use artificial intelligence', 'Organize my work', 'Build a website or store'],
    recommend: 'Show recommended tools', recommendation: 'Recommended selection',
    academyLabel: 'LEARN AND GROW', academyTitle: 'AQUI NET ACADEMY',
    academyText: 'Practical learning paths to build digital skills at your own pace.',
    academyAction: 'Explore learning tools',
    businessLabel: 'TURN IDEAS INTO PROJECTS', businessTitle: 'AQUI NET BUSINESS',
    businessText: 'Resources to structure a business, find customers and build an online presence.',
    businessAction: 'Explore business tools',
    footer: 'Discover. Create. Progress.', backTop: 'Back to top',
    pathsTitle: 'Learning paths that lead to action',
    pathsText: 'Follow practical steps at your own pace and build real projects.',
    startPath: 'Explore useful tools', progressTitle: 'Your progress',
    businessRoadmap: 'Steps to start a business',
    businessWarning: 'Income is not guaranteed. Test your idea on a small scale and avoid expenses you cannot afford.',
    adsTitle: 'AQUI NET ADS', adsText: 'A space intended to present visibility and promotion opportunities on AQUI NET HUB.',
    adsStatus: 'Coming soon', adsInfo: 'Advertising campaigns, advertiser statistics and payments are not yet enabled.',
    partnersTitle: 'AQUI NET PARTNERS', partnersText: 'A space planned for creators, educators, businesses and partners who want to contribute to the hub.',
    partnersStatus: 'Coming soon', partnersInfo: 'Partner registration and automated collaboration tracking are not yet available.',
    transparency: 'Transparency', transparencyText: 'Ads and Partners sections explain future services. Advertising purchases, payments and partner registration are not currently available.',
    privacyTitle: 'Data and privacy', privacyText: 'Favorites are stored only in your browser on this device. They are not synced across devices and this feature does not create a user account.',
    faqTitle: 'Frequently asked questions',
    faq: [
      ['Do the listed tools belong to AQUI NET HUB?', 'No. They are external services. AQUI NET HUB lists them and links to their official websites.'],
      ['Are all tools free?', 'No. Some are free, while others offer paid features. Always check the official website.'],
      ['Can I access my favorites on another phone?', 'No. They are stored on this device and browser.'],
      ['Can I buy an ad on AQUI NET HUB now?', 'No. The Ads section is being prepared. Advertising orders and payments are not enabled yet.']
    ]
  }
};

function App() {
  const [language, setLanguage] = useState<Language>('fr');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [goal, setGoal] = useState('');
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const t = copy[language];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aqui-net-hub-favorites') || '[]');
      if (Array.isArray(saved)) setFavorites(saved.filter((x): x is string => typeof x === 'string'));
    } catch {
      setFavorites([]);
    }
    try {
      const savedProgress = JSON.parse(localStorage.getItem('aqui-net-hub-progress') || '[]');
      if (Array.isArray(savedProgress)) setCompleted(savedProgress.filter((x): x is string => typeof x === 'string'));
    } catch {
      setCompleted([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aqui-net-hub-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('aqui-net-hub-progress', JSON.stringify(completed));
  }, [completed]);

  const filteredTools = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return tools.filter(tool => {
      const categoryName = categories.find(c => c.id === tool.category)?.[language] ?? '';
      return (category === 'all' || tool.category === category) &&
        (!favoritesOnly || favorites.includes(tool.name)) &&
        (!term || `${tool.name} ${tool.description} ${categoryName} ${tool.access} ${tool.platforms}`.toLocaleLowerCase().includes(term));
    });
  }, [search, category, language, favoritesOnly, favorites]);

  const recommended = useMemo(() => {
    const mapping: Record<string, Category[]> = {
      video: ['content', 'ai', 'marketing'],
      business: ['business', 'marketing', 'productivity'],
      learning: ['learning', 'ai', 'translation'],
      ai: ['ai', 'content', 'productivity'],
      work: ['productivity', 'ai'],
      website: ['development', 'business', 'marketing']
    };
    const keys = mapping[goal] ?? [];
    return tools.filter(tool => keys.includes(tool.category)).slice(0, 6);
  }, [goal]);

  const scrollToTools = (nextCategory: Category | 'all') => {
    setCategory(nextCategory);
    setFavoritesOnly(false);
    document.getElementById('tool-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleFavorite = (name: string) => {
    setFavorites(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]);
  };

  const toggleProgre
