import { useMemo, useState } from 'react';

type Language = 'fr' | 'en';
type Category = 'ai' | 'content' | 'productivity' | 'learning' | 'translation' | 'development' | 'marketing' | 'business';
type Tool = { name: string; category: Category; description: string; access: string; platforms: string; url: string };

const tools: Tool[] = [
  { name: 'ChatGPT', category: 'ai', description: 'Assistant IA pour rédiger, apprendre, analyser et créer.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://chatgpt.com/' },
  { name: 'Gemini', category: 'ai', description: 'Assistant IA de Google pour la recherche et la création.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://gemini.google.com/' },
  { name: 'Claude', category: 'ai', description: 'Assistant IA pour écrire, analyser et travailler.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://claude.ai/' },
  { name: 'Perplexity', category: 'ai', description: 'Recherche assistée par IA avec des réponses sourcées.', access: 'Freemium', platforms: 'Web · Android · iOS', url: 'https://www.perplexity.ai/' },
  { name: 'Microsoft Copilot', category: 'ai', description: 'Assistant IA pour les questions, la rédaction et la création.', access: 'Gratuit avec options payantes', platforms: 'Web · Android · iOS · Windows', url: 'https://copilot.microsoft.com/' },
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

const copy = {
  fr: {
    nav: ['Découvrir', 'NET ASSIST', 'Academy', 'Business'], eyebrow: 'LE HUB DU NUMÉRIQUE', title: 'Le bon outil numérique.', accent: 'Au bon moment.', intro: 'Découvrez des outils, comparez leurs possibilités et trouvez les ressources adaptées à vos projets.', search: 'Rechercher un outil ou un besoin…', searchBtn: 'Rechercher', hint: 'Des ressources numériques pour apprendre, créer et développer vos projets.', toolsEyebrow: 'AQUI NET TOOLS', toolsTitle: 'Explorez les outils numériques', all: 'Toutes les catégories', filter: 'Filtrer par catégorie', reset: 'Tout réinitialiser', results: 'outil(s) trouvé(s)', access: 'Accès', platforms: 'Plateformes', visit: 'Site officiel', empty: 'Aucun résultat. Essayez un autre mot-clé ou réinitialisez les filtres.', assistEyebrow: 'VOTRE ASSISTANT D’ORIENTATION', assistTitle: 'Quel est votre objectif ?', assistText: 'Choisissez votre besoin : NET ASSIST vous propose une sélection d’outils adaptés.', choose: 'Sélectionnez un objectif', goals: ['Créer des vidéos et publications', 'Lancer une activité en ligne', 'Apprendre une compétence', 'Utiliser l’intelligence artificielle', 'Organiser mon travail', 'Créer un site ou une boutique'], recommend: 'Voir les outils recommandés', recommendation: 'Votre sélection recommandée', noRec: 'Choisissez un objectif pour afficher des outils pertinents.', academyLabel: 'APPRENDRE ET PROGRESSER', academyTitle: 'AQUI NET ACADEMY', academyText: 'Des parcours pratiques pour développer vos compétences numériques, à votre rythme.', academyPoints: ['Guides pratiques et tutoriels', 'Compétences numériques essentielles', 'Méthodes de création et de productivité'], academyAction: 'Explorer les outils de formation', businessLabel: 'TRANSFORMER LES IDÉES EN PROJETS', businessTitle: 'AQUI NET BUSINESS', businessText: 'Des ressources pour structurer une activité, trouver des clients et développer une présence en ligne.', businessPoints: ['Présenter et promouvoir une activité', 'Créer une présence et une boutique en ligne', 'Découvrir des solutions accessibles'], businessAction: 'Découvrir les outils business', footer: 'Découvrir. Créer. Progresser.', backTop: 'Retour en haut'
  },
  en: {
    nav: ['Discover', 'NET ASSIST', 'Academy', 'Business'], eyebrow: 'THE DIGITAL HUB', title: 'The right digital tool.', accent: 'At the right time.', intro: 'Discover tools, compare their features and find resources suited to your projects.', search: 'Search for a tool or a need…', searchBtn: 'Search', hint: 'Digital resources to learn, create and grow your projects.', toolsEyebrow: 'AQUI NET TOOLS', toolsTitle: 'Explore digital tools', all: 'All categories', filter: 'Filter by category', reset: 'Reset all', results: 'tool(s) found', access: 'Access', platforms: 'Platforms', visit: 'Official website', empty: 'No results. Try another keyword or reset the filters.', assistEyebrow: 'YOUR DIGITAL GUIDE', assistTitle: 'What is your goal?', assistText: 'Choose what you need and NET ASSIST will suggest relevant tools.', choose: 'Select a goal', goals: ['Create videos and posts', 'Start an online business', 'Learn a skill', 'Use artificial intelligence', 'Organize my work', 'Build a website or store'], recommend: 'Show recommended tools', recommendation: 'Recommended selection', noRec: 'Choose a goal to see relevant tools.', academyLabel: 'LEARN AND GROW', academyTitle: 'AQUI NET ACADEMY', academyText: 'Practical learning paths to build digital skills at your own pace.', academyPoints: ['Practical guides and tutorials', 'Essential digital skills', 'Creation and productivity methods'], academyAction: 'Explore learning tools', businessLabel: 'TURN IDEAS INTO PROJECTS', businessTitle: 'AQUI NET BUSINESS', businessText: 'Resources to structure a business, find customers and build an online presence.', businessPoints: ['Present and promote a business', 'Build an online presence and store', 'Discover accessible solutions'], businessAction: 'Explore business tools', footer: 'Discover. Create. Progress.', backTop: 'Back to top'
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
      return (category === 'all' || tool.category === category) &&
        (!term || `${tool.name} ${tool.description} ${categoryName} ${tool.access} ${tool.platforms}`.toLocaleLowerCase().includes(term));
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
    document.getElementById('tool-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goalOptions = [
    { value: 'video', label: t.goals[0] }, { value: 'business', label: t.goals[1] },
    { value: 'learning', label: t.goals[2] }, { value: 'ai', label: t.goals[3] },
    { value: 'work', label: t.goals[4] }, { value: 'website', label: t.goals[5] }
  ];

  return <main className="site-shell" lang={language}>
    <header className="topbar">
      <a className="brand" href="#home" aria-label="AQUI NET HUB - accueil"><span className="brand-mark">A</span><span>AQUI <strong>NET HUB</strong></span></a>
      <nav aria-label="Navigation principale">{t.nav.map((label, i) => <a key={label} href={['#decouvrir', '#assist', '#academy', '#business'][i]}>{label}</a>)}</nav>
      <button className="language-button" type="button" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')} aria-label={language === 'fr' ? 'Switch to English' : 'Passer en français'}>{language === 'fr' ? 'EN' : 'FR'}</button>
    </header>

    <section className="hero" id="home">
      <div className="hero-content"><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}<br/><span>{t.accent}</span></h1><p className="hero-copy">{t.intro}</p>
        <form className="search" onSubmit={e => { e.preventDefault(); scrollToTools('all'); }}><input aria-label={t.search} type="search" placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)}/><button type="submit">{t.searchBtn}</button></form>
        <p className="microcopy">{t.hint}</p>
      </div>
      <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
    </section>

    <section className="section" id="decouvrir">
      <div className="section-heading"><div><p className="eyebrow">{t.toolsEyebrow}</p><h2>{t.toolsTitle}</h2></div><span className="section-count">{tools.length} outils sélectionnés</span></div>
      <div className="category-grid">{categories.map(item => <button key={item.id} type="button" className={`category-card${category === item.id ? ' is-active' : ''}`} aria-pressed={category === item.id} onClick={() => scrollToTools(item.id)}><span className="card-symbol">{item.icon}</span><h3>{item[language]}</h3><span className="card-arrow">↗</span></button>)}</div>
      <div className="tool-filters" id="tool-results"><label htmlFor="category-filter">{t.filter}</label><select id="category-filter" value={category} onChange={e => setCategory(e.target.value as Category | 'all')}><option value="all">{t.all}</option>{categories.map(item => <option key={item.id} value={item.id}>{item[language]}</option>)}</select><button type="button" onClick={() => { setSearch(''); setCategory('all'); }}>{t.reset}</button></div>
      <p className="results-count" aria-live="polite"><strong>{filteredTools.length}</strong> {t.results}</p>
      {filteredTools.length ? <div className="tools-grid">{filteredTools.map(tool => <article className="tool-card" key={tool.name}><div className="tool-card-top"><span className="tool-category">{categories.find(c => c.id === tool.category)?.[language]}</span><span className="tool-dot"/></div><h3>{tool.name}</h3><p className="tool-description">{tool.description}</p><div className="tool-meta"><p><strong>{t.access} :</strong> {tool.access}</p><p><strong>{t.platforms} :</strong> {tool.platforms}</p></div><a className="tool-link" href={tool.url} target="_blank" rel="noopener noreferrer">{t.visit} <span>↗</span></a></article>)}</div> : <div className="empty-state"><span>⌕</span><p>{t.empty}</p></div>}
    </section>

    <section className="assist-section" id="assist"><div className="assist-intro"><p className="eyebrow">{t.assistEyebrow}</p><h2>{t.assistTitle}</h2><p>{t.assistText}</p></div><div className="assist-box"><label htmlFor="goal-select">{t.choose}</label><select id="goal-select" value={goal} onChange={e => { setGoal(e.target.value); setShowRecommendations(false); }}><option value="">—</option>{goalOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="primary-button" type="button" disabled={!goal} onClick={() => setShowRecommendations(true)}>{t.recommend} <span>→</span></button>{showRecommendations && <div className="recommendations"><h3>{t.recommendation}</h3><div className="recommendation-list">{recommended.map(tool => <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer"><span>{tool.name}</span><span>↗</span></a>)}</div></div>}</div></section>

    <section className="section modules"><article className="module-card academy-card" id="academy"><div className="module-icon">✦</div><p className="eyebrow">{t.academyLabel}</p><h2>{t.academyTitle}</h2><p className="module-copy">{t.academyText}</p><ul>{t.academyPoints.map(point => <li key={point}>{point}</li>)}</ul><button className="text-button" type="button" onClick={() => scrollToTools('learning')}>{t.academyAction} <span>→</span></button></article><article className="module-card business-card" id="business"><div className="module-icon">◇</div><p className="eyebrow">{t.businessLabel}</p><h2>{t.businessTitle}</h2><p className="module-copy">{t.businessText}</p><ul>{t.businessPoints.map(point => <li key={point}>{point}</li>)}</ul><button className="text-button" type="button" onClick={() => scrollToTools('business')}>{t.businessAction} <span>→</span></button></article></section>

    <footer><a className="brand footer-brand" href="#home"><span className="brand-mark">A</span><span>AQUI <strong>NET HUB</strong></span></a><p>{t.footer}</p><small>© {new Date().getFullYear()} AQUI NET HUB · <a href="#home">{t.backTop} ↑</a></small></footer>
  </main>;
}

export default App;
