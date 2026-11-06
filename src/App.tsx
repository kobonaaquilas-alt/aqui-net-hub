
import { useMemo, useState } from 'react';

type Language = 'fr' | 'en';
type Category = 'ai' | 'content' | 'productivity' | 'learning' | 'translation' | 'development' | 'marketing' | 'business';

type Tool = {
  name: string;
  category: Category;
  description: string;
  descriptionEn: string;
  access: string;
  accessEn: string;
  platforms: string;
  platformsEn: string;
  url: string;
};

const tools: Tool[] = [
  {
    name: 'ChatGPT', category: 'ai',
    description: 'Assistant IA pour rédiger, apprendre, analyser et créer.',
    descriptionEn: 'AI assistant for writing, learning, analyzing and creating.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://chatgpt.com/'
  },
  {
    name: 'Gemini', category: 'ai',
    description: 'Assistant IA de Google pour la recherche et la création.',
    descriptionEn: 'Google AI assistant for research and content creation.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://gemini.google.com/'
  },
  {
    name: 'Claude', category: 'ai',
    description: 'Assistant IA pour écrire, analyser et travailler.',
    descriptionEn: 'AI assistant for writing, analysis and professional work.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://claude.ai/'
  },
  {
    name: 'Perplexity', category: 'ai',
    description: 'Recherche assistée par IA avec des réponses sourcées.',
    descriptionEn: 'AI-powered search with cited answers and sources.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.perplexity.ai/'
  },
  {
    name: 'Microsoft Copilot', category: 'ai',
    description: 'Assistant IA pour les questions, la rédaction et la création.',
    descriptionEn: 'AI assistant for questions, writing and content creation.',
    access: 'Gratuit avec options payantes', accessEn: 'Free with paid options',
    platforms: 'Web · Android · iOS · Windows', platformsEn: 'Web · Android · iOS · Windows',
    url: 'https://copilot.microsoft.com/'
  },
  {
    name: 'Canva', category: 'content',
    description: 'Création de visuels, présentations, affiches et contenus graphiques.',
    descriptionEn: 'Create visuals, presentations, posters and graphic content.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.canva.com/'
  },
  {
    name: 'CapCut', category: 'content',
    description: 'Montage vidéo et création de contenus pour les réseaux sociaux.',
    descriptionEn: 'Video editing and content creation for social media.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.capcut.com/'
  },
  {
    name: 'Photopea', category: 'content',
    description: 'Éditeur graphique en ligne pour retoucher des images.',
    descriptionEn: 'Online graphic editor for image retouching.',
    access: 'Gratuit avec publicité', accessEn: 'Free with ads',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://www.photopea.com/'
  },
  {
    name: 'Adobe Express', category: 'content',
    description: 'Création de visuels, affiches, vidéos et publications.',
    descriptionEn: 'Create visuals, posters, videos and social media posts.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.adobe.com/express/'
  },
  {
    name: 'OBS Studio', category: 'content',
    description: 'Enregistrement vidéo et diffusion en direct sur ordinateur.',
    descriptionEn: 'Video recording and live streaming on computers.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Windows · macOS · Linux', platformsEn: 'Windows · macOS · Linux',
    url: 'https://obsproject.com/'
  },
  {
    name: 'Notion', category: 'productivity',
    description: 'Organisation du travail, notes et gestion de projets.',
    descriptionEn: 'Workspace organization, note-taking and project management.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.notion.com/'
  },
  {
    name: 'Trello', category: 'productivity',
    description: 'Organisation des tâches et suivi des projets.',
    descriptionEn: 'Task organization and project tracking.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://trello.com/'
  },
  {
    name: 'Google Drive', category: 'productivity',
    description: 'Stockage, partage et organisation de fichiers en ligne.',
    descriptionEn: 'Online file storage, sharing and organization.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://drive.google.com/'
  },
  {
    name: 'Khan Academy', category: 'learning',
    description: 'Cours et exercices pour apprendre gratuitement.',
    descriptionEn: 'Free courses and exercises for learning.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.khanacademy.org/'
  },
  {
    name: 'freeCodeCamp', category: 'learning',
    description: 'Apprentissage gratuit de la programmation.',
    descriptionEn: 'Free programming and coding education.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://www.freecodecamp.org/'
  },
  {
    name: 'Coursera', category: 'learning',
    description: 'Cours en ligne proposés par des universités et entreprises.',
    descriptionEn: 'Online courses offered by universities and companies.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.coursera.org/'
  },
  {
    name: 'Duolingo', category: 'learning',
    description: 'Apprentissage des langues avec des exercices interactifs.',
    descriptionEn: 'Learn languages through interactive exercises.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.duolingo.com/'
  },
  {
    name: 'DeepL', category: 'translation',
    description: 'Traduction de textes et de documents dans plusieurs langues.',
    descriptionEn: 'Translate texts and documents into multiple languages.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://www.deepl.com/translator'
  },
  {
    name: 'GitHub Copilot', category: 'development',
    description: 'Assistant IA pour écrire, comprendre et améliorer du code.',
    descriptionEn: 'AI coding assistant for writing, understanding and improving code.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web · IDE', platformsEn: 'Web · IDE',
    url: 'https://github.com/features/copilot'
  },
  {
    name: 'Google Trends', category: 'marketing',
    description: 'Repérez les sujets recherchés et comparez les tendances.',
    descriptionEn: 'Discover popular search topics and compare trends.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://trends.google.com/trends/'
  },
  {
    name: 'Meta Business Suite', category: 'marketing',
    description: 'Gérez les publications, messages et statistiques de vos Pages Facebook et Instagram.',
    descriptionEn: 'Manage posts, messages and insights for Facebook and Instagram Pages.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web · Android · iOS', platformsEn: 'Web · Android · iOS',
    url: 'https://business.facebook.com/'
  },
  {
    name: 'TikTok Studio', category: 'marketing',
    description: 'Gérez vos contenus TikTok et consultez les statistiques de votre compte.',
    descriptionEn: 'Manage TikTok content and view your account analytics.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web · Android', platformsEn: 'Web · Android',
    url: 'https://www.tiktok.com/tiktokstudio'
  },
  {
    name: 'Google Analytics', category: 'marketing',
    description: 'Mesurez la fréquentation de votre site et comprenez vos visiteurs.',
    descriptionEn: 'Measure website traffic and understand your visitors.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://analytics.google.com/'
  },
  {
    name: 'Google Search Console', category: 'marketing',
    description: 'Suivez la présence de votre site dans Google et repérez les problèmes.',
    descriptionEn: 'Monitor your website presence on Google and identify issues.',
    access: 'Gratuit', accessEn: 'Free',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://search.google.com/search-console/about'
  },
  {
    name: 'WhatsApp Business', category: 'business',
    description: 'Présentez votre activité et échangez avec vos clients.',
    descriptionEn: 'Showcase your business and communicate with customers.',
    access: 'Gratuit au téléchargement', accessEn: 'Free to download',
    platforms: 'Android · iOS', platformsEn: 'Android · iOS',
    url: 'https://www.whatsapp.com/business/'
  },
  {
    name: 'Systeme.io', category: 'business',
    description: 'Créez des pages de vente, tunnels, campagnes e-mail et formations.',
    descriptionEn: 'Create sales pages, funnels, email campaigns and online courses.',
    access: 'Freemium', accessEn: 'Freemium',
    platforms: 'Web', platformsEn: 'Web',
    url: 'https://systeme.io/'
  },
  {
    name: 'WooCommerce', category: 'business',
    description: 'Ajoutez une boutique en ligne à WordPress. Hébergement et services annexes payants.',
    descriptionEn: 'Add an online store to WordPress. Hosting and additional services may cost extra.',
    access: 'Extension gratuite · coûts annexes', accessEn: 'Free plugin · additional costs',
    platforms: 'Web · WordPress', platformsEn: 'Web · WordPress',
    url: 'https://woocommerce.com/'
  }
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

const copy = {
  fr: {
    nav: ['Découvrir', 'NET ASSIST', 'Academy', 'Business'],
    eyebrow: 'LE HUB DU NUMÉRIQUE',
    title: 'Le bon outil numérique.',
    accent: 'Au bon moment.',
    intro: 'Découvrez des outils, comparez leurs possibilités et trouvez les ressources adaptées à vos projets.',
    search: 'Rechercher un outil ou un besoin…',
    searchBtn: 'Rechercher',
    hint: 'Des ressources numériques pour apprendre, créer et développer vos projets.',
    toolsEyebrow: 'AQUI NET TOOLS',
    toolsTitle: 'Explorez les outils numériques',
    selected: 'outils sélectionnés',
    all: 'Toutes les catégories',
    filter: 'Filtrer par catégorie',
    reset: 'Tout réinitialiser',
    results: 'outil(s) trouvé(s)',
    access: 'Accès',
    platforms: 'Plateformes',
    visit: 'Site officiel',
    empty: 'Aucun résultat. Essayez un autre mot-clé ou réinitialisez les filtres.',
    assistEyebrow: 'VOTRE ASSISTANT D’ORIENTATION',
    assistTitle: 'Quel est votre objectif ?',
    assistText: 'Choisissez votre besoin : NET ASSIST vous propose une sélection d’outils adaptés.',
    choose: 'Sélectionnez un objectif',
    goals: ['Créer des vidéos et publications', 'Lancer une activité en ligne', 'Apprendre une compétence', 'Utiliser l’intelligence artificielle', 'Organiser mon travail', 'Créer un site ou une boutique'],
    recommend: 'Voir les outils recommandés',
    recommendation: 'Votre sélection recommandée',
    noRec: 'Choisissez un objectif pour afficher des outils pertinents.',
    academyLabel: 'APPRENDRE ET PROGRESSER',
    academyTitle: 'AQUI NET ACADEMY',
    academyText: 'Des parcours pratiques pour développer vos compétences numériques, à votre rythme.',
    academyPoints: ['Guides pratiques et tutoriels', 'Compétences numériques essentielles', 'Méthodes de création et de productivité'],
    academyAction: 'Explorer les outils de formation',
    businessLabel: 'TRANSFORMER LES IDÉES EN PROJETS',
    businessTitle: 'AQUI NET BUSINESS',
    businessText: 'Des ressources pour structurer une activité, trouver des clients et développer une présence en ligne.',
    businessPoints: ['Présenter et promouvoir une activité', 'Créer une présence et une boutique en ligne', 'Découvrir des solutions accessibles'],
    businessAction: 'Découvrir les outils business',
    footer: 'Découvrir. Créer. Progresser.',
    backTop: 'Retour en haut'
  },
  en: {
    nav: ['Discover', 'NET ASSIST', 'Academy', 'Business'],
    eyebrow: 'THE DIGITAL HUB',
    title: 'The right digital tool.',
    accent: 'At the right time.',
    intro: 'Discover tools, compare their features and find resources suited to your projects.',
    search: 'Search for a tool or a need…',
    searchBtn: 'Search',
    hint: 'Digital resources to learn, create and grow your projects.',
    toolsEyebrow: 'AQUI NET TOOLS',
    toolsTitle: 'Explore digital tools',
    selected: 'tools selected',
    all: 'All categories',
    filter: 'Filter by category',
    reset: 'Reset all',
    results: 'tool(s) found',
    access: 'Access',
    platforms: 'Platforms',
    visit: 'Official website',
    empty: 'No results. Try another keyword or reset the filters.',
    assistEyebrow: 'YOUR DIGITAL GUIDE',
    assistTitle: 'What is your goal?',
    assistText: 'Choose what you need and NET ASSIST will suggest relevant tools.',
    choose: 'Select a goal',
    goals: ['Create videos and posts', 'Start an online business', 'Learn a skill', 'Use artificial intelligence', 'Organize my work', 'Build a website or store'],
    recommend: 'Show recommended tools',
    recommendation: 'Recommended selection',
    noRec: 'Choose a goal to see relevant tools.',
    academyLabel: 'LEARN AND GROW',
    academyTitle: 'AQUI NET ACADEMY',
    academyText: 'Practical learning paths to build digital skills at your own pace.',
    academyPoints: ['Practical guides and tutorials', 'Essential digital skills', 'Creation and productivity methods'],
    academyAction: 'Explore learning tools',
    businessLabel: 'TURN IDEAS INTO PROJECTS',
    businessTitle: 'AQUI NET BUSINESS',
    businessText: 'Resources to structure a business, find customers and build an online presence.',
    businessPoints: ['Present and promote a business', 'Build an online presence and store', 'Discover accessible solutions'],
    businessAction: 'Explore business tools',
    footer: 'Discover. Create. Progress.',
    backTop: 'Back to top'
  }
};

function App() {
  const [language, setLanguage] = useState<Language>('fr');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [goal, setGoal] = useState('');
  const [showRecommendations, setShowRecommendations] = useState(false);

  const t = copy[language];

  const filteredTools = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();

    return tools.filter(tool => {
      const categoryName = categories.find(c => c.id === tool.category)?.[language] ?? '';

      const searchableText = [
        tool.name,
        tool.description,
        tool.descriptionEn,
        tool.access,
        tool.accessEn,
        tool.platforms,
        tool.platformsEn,
        categoryName
      ].join(' ').toLocaleLowerCase();

      return (category === 'all' || tool.category === category) &&
        (!term || searchableText.includes(term));
    });
  }, [search, category, language]);

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
    document.getElementById('tool-results')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  const goalOptions = [
    { value: 'video', label: t.goals[0] },
    { value: 'business', label: t.goals[1] },
    { value: 'learning', label: t.goals[2] },
    { value: 'ai', label: t.goals[3] },
    { value: 'work', label: t.goals[4] },
    { value: 'website', label: t.goals[5] }
  ];

  return (
    <main className="site-shell" lang={language}>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="AQUI NET HUB - accueil">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>

        <nav aria-label={language === 'fr' ? 'Navigation principale' : 'Main navigation'}>
          {t.nav.map((label, i) => (
            <a key={label} href={['#decouvrir', '#assist', '#academy', '#business'][i]}>
              {label}
            </a>
          ))}
        </nav>

        <button
          className="language-button"
          type="button"
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'}
        >
          {language === 'fr' ? 'EN' : 'FR'}
        </button>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}<br /><span>{t.accent}</span></h1>
          <p className="hero-copy">{t.intro}</p>

          <form
            className="search"
            onSubmit={e => {
              e.preventDefault();
              scrollToTools('all');
            }}
          >
            <input
              aria-label={t.search}
              type="search"
              placeholder={t.search}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit">{t.searchBtn}</button>
          </form>

          <p className="microcopy">{t.hint}</p>
        </div>

        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
      </section>

      <section className="section" id="decouvrir">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.toolsEyebrow}</p>
            <h2>{t.toolsTitle}</h2>
          </div>
          <span className="section-count">
            {tools.length} {t.selected}
          </span>
        </div>

        <div className="category-grid">
          {categories.map(item => (
            <button
              key={item.id}
              type="button"
              className={`category-card${category === item.id ? ' is-active' : ''}`}
              aria-pressed={category === item.id}
              onClick={() => scrollToTools(item.id)}
            >
           
