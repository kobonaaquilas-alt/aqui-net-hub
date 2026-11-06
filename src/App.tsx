
import { useMemo, useState } from "react";

type Language = "fr" | "en";

type CategoryKey =
  | "ai"
  | "content"
  | "productivity"
  | "learning"
  | "translation"
  | "development"
  | "marketing"
  | "business";

type Tool = {
  name: string;
  category: CategoryKey;
  description: { fr: string; en: string };
  access: { fr: string; en: string };
  platforms: string;
  url: string;
};

const tools: Tool[] = [
  {
    name: "ChatGPT",
    category: "ai",
    description: {
      fr: "Assistant IA pour rédiger, apprendre, analyser et créer.",
      en: "AI assistant for writing, learning, analysis and creation."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://chatgpt.com/"
  },
  {
    name: "Gemini",
    category: "ai",
    description: {
      fr: "Assistant IA de Google pour la recherche et la création.",
      en: "Google AI assistant for research and creative tasks."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://gemini.google.com/"
  },
  {
    name: "Claude",
    category: "ai",
    description: {
      fr: "Assistant IA pour écrire, analyser et travailler.",
      en: "AI assistant for writing, analysis and productivity."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://claude.ai/"
  },
  {
    name: "Perplexity",
    category: "ai",
    description: {
      fr: "Moteur de recherche IA avec des réponses accompagnées de sources.",
      en: "AI search engine providing answers with sources."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.perplexity.ai/"
  },
  {
    name: "Microsoft Copilot",
    category: "ai",
    description: {
      fr: "Assistant IA pour les questions, la rédaction et la création.",
      en: "AI assistant for questions, writing and creative tasks."
    },
    access: { fr: "Gratuit avec options payantes", en: "Free with paid options" },
    platforms: "Web · Android · iOS · Windows",
    url: "https://copilot.microsoft.com/"
  },
  {
    name: "Canva",
    category: "content",
    description: {
      fr: "Création de visuels, présentations et contenus graphiques.",
      en: "Create visuals, presentations and graphic content."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.canva.com/"
  },
  {
    name: "CapCut",
    category: "content",
    description: {
      fr: "Montage vidéo et création de contenus pour les réseaux sociaux.",
      en: "Video editing and social media content creation."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.capcut.com/"
  },
  {
    name: "Photopea",
    category: "content",
    description: {
      fr: "Éditeur graphique en ligne pour les images.",
      en: "Online graphic editor for images."
    },
    access: { fr: "Gratuit avec publicité", en: "Free with advertising" },
    platforms: "Web",
    url: "https://www.photopea.com/"
  },
  {
    name: "Adobe Express",
    category: "content",
    description: {
      fr: "Création de visuels, affiches, vidéos et publications.",
      en: "Create visuals, posters, videos and social media posts."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.adobe.com/express/"
  },
  {
    name: "OBS Studio",
    category: "content",
    description: {
      fr: "Enregistrement vidéo et diffusion en direct depuis un ordinateur.",
      en: "Video recording and live streaming from a computer."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Windows · macOS · Linux",
    url: "https://obsproject.com/"
  },
  {
    name: "Notion",
    category: "productivity",
    description: {
      fr: "Organisation du travail, notes et gestion de projets.",
      en: "Workspace organization, notes and project management."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.notion.com/"
  },
  {
    name: "Trello",
    category: "productivity",
    description: {
      fr: "Organisation des tâches et suivi des projets.",
      en: "Task organization and project tracking."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://trello.com/"
  },
  {
    name: "Grammarly",
    category: "productivity",
    description: {
      fr: "Correction grammaticale et amélioration de textes.",
      en: "Grammar correction and writing improvement."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Extensions",
    url: "https://www.grammarly.com/"
  },
  {
    name: "Google Drive",
    category: "productivity",
    description: {
      fr: "Stockage, partage et organisation de fichiers en ligne.",
      en: "Online file storage, sharing and organization."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://drive.google.com/"
  },
  {
    name: "Khan Academy",
    category: "learning",
    description: {
      fr: "Cours et exercices pour apprendre gratuitement.",
      en: "Free courses and exercises for learning."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web · Android · iOS",
    url: "https://www.khanacademy.org/"
  },
  {
    name: "freeCodeCamp",
    category: "learning",
    description: {
      fr: "Apprentissage gratuit de la programmation.",
      en: "Free programming education."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web",
    url: "https://www.freecodecamp.org/"
  },
  {
    name: "Coursera",
    category: "learning",
    description: {
      fr: "Cours en ligne proposés par des universités et entreprises.",
      en: "Online courses offered by universities and companies."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.coursera.org/"
  },
  {
    name: "Duolingo",
    category: "learning",
    description: {
      fr: "Apprentissage des langues avec des exercices interactifs.",
      en: "Learn languages through interactive exercises."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.duolingo.com/"
  },
  {
    name: "DeepL",
    category: "translation",
    description: {
      fr: "Traduction de textes et de documents dans plusieurs langues.",
      en: "Translate texts and documents into multiple languages."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · Android · iOS",
    url: "https://www.deepl.com/translator"
  },
  {
    name: "GitHub Copilot",
    category: "development",
    description: {
      fr: "Assistant IA pour écrire, comprendre et améliorer du code.",
      en: "AI assistant for writing, understanding and improving code."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web · IDE",
    url: "https://github.com/features/copilot"
  },
  {
    name: "Google Trends",
    category: "marketing",
    description: {
      fr: "Repérez les sujets recherchés et comparez l'intérêt pour des idées de contenu ou de produits.",
      en: "Discover searched topics and compare interest in content or product ideas."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web",
    url: "https://trends.google.com/trends/"
  },
  {
    name: "Meta Business Suite",
    category: "marketing",
    description: {
      fr: "Gérez les publications, messages et statistiques de vos Pages Facebook et comptes Instagram.",
      en: "Manage posts, messages and insights for Facebook Pages and Instagram accounts."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web · Android · iOS",
    url: "https://business.facebook.com/"
  },
  {
    name: "TikTok Studio",
    category: "marketing",
    description: {
      fr: "Gérez vos contenus TikTok et consultez les statistiques de votre compte.",
      en: "Manage TikTok content and review account analytics."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web · Android",
    url: "https://www.tiktok.com/tiktokstudio"
  },
  {
    name: "Google Analytics",
    category: "marketing",
    description: {
      fr: "Mesurez la fréquentation de votre site et comprenez le comportement des visiteurs.",
      en: "Measure website traffic and understand visitor behavior."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web",
    url: "https://analytics.google.com/"
  },
  {
    name: "Google Search Console",
    category: "marketing",
    description: {
      fr: "Suivez la présence de votre site dans les résultats de recherche Google et repérez les problèmes.",
      en: "Monitor your site's presence in Google Search and identify issues."
    },
    access: { fr: "Gratuit", en: "Free" },
    platforms: "Web",
    url: "https://search.google.com/search-console/about"
  },
  {
    name: "WhatsApp Business",
    category: "business",
    description: {
      fr: "Présentez votre activité et échangez avec vos clients grâce aux outils professionnels de messagerie.",
      en: "Present your business and communicate with customers using business messaging tools."
    },
    access: { fr: "Gratuit au téléchargement", en: "Free to download" },
    platforms: "Android · iOS",
    url: "https://www.whatsapp.com/business/"
  },
  {
    name: "Systeme.io",
    category: "business",
    description: {
      fr: "Créez des pages de vente, tunnels, campagnes e-mail et formations en ligne.",
      en: "Build sales pages, funnels, email campaigns and online courses."
    },
    access: { fr: "Freemium", en: "Freemium" },
    platforms: "Web",
    url: "https://systeme.io/"
  },
  {
    name: "WooCommerce",
    category: "business",
    description: {
      fr: "Ajoutez une boutique en ligne à WordPress. L'extension est gratuite, mais l'hébergement et certains services sont payants.",
      en: "Add an online store to WordPress. The plugin is free, but hosting and some services cost extra."
    },
    access: { fr: "Gratuit · coûts annexes", en: "Free · additional costs" },
    platforms: "Web · WordPress",
    url: "https://woocommerce.com/"
  }
];

const translations = {
  fr: {
    navDiscover: "Découvrir",
    navAssist: "NET ASSIST",
    navAcademy: "Academy",
    navBusiness: "Business",
    navLabel: "Navigation principale",
    eyebrow: "LE HUB DU NUMÉRIQUE",
    heroTitle: "Le bon outil numérique.",
    heroSubtitle: "Au bon moment.",
    heroDescription: "Découvrez des outils, comparez leurs possibilités et trouvez les ressources adaptées à vos projets.",
    searchPlaceholder: "Rechercher un outil...",
    searchButton: "Rechercher",
    microcopy: "Un répertoire accessible à tous, partout dans le monde.",
    toolsEyebrow: "AQUI NET TOOLS",
    explore: "Explorez les outils numériques",
    categoryDescription: "Explorer les outils de cette catégorie.",
    allCategories: "Toutes les catégories",
    filter: "Filtrer par catégorie :",
    reset: "Réinitialiser",
    found: "outil(s) trouvé(s)",
    access: "Accès :",
    platforms: "Plateformes :",
    visit: "Visiter le site officiel →",
    empty: "Aucun outil trouvé. Essayez une autre recherche.",
    assistTitle: "Vous avez un objectif ?",
    assistSubtitle: "Trouvons le bon outil.",
    assistDescription: "Décrivez votre besoin pour découvrir des solutions pertinentes.",
    learn: "APPRENDRE",
    guides: "Guides, tutoriels et ressources numériques.",
    develop: "DÉVELOPPER",
    services: "Des services numériques pour vos projets.",
    slogan: "Découvrir. Créer. Progresser."
  },
  en: {
    navDiscover: "Discover",
    navAssist: "NET ASSIST",
    navAcademy: "Academy",
    navBusiness: "Business",
    navLabel: "Main navigation",
    eyebrow: "THE DIGITAL HUB",
    heroTitle: "The right digital tool.",
    heroSubtitle: "At the right time.",
    heroDescription: "Discover tools, compare their features and find resources suited to your projects.",
    searchPlaceholder: "Search for a tool...",
    searchButton: "Search",
    microcopy: "A directory accessible to everyone, everywhere.",
    toolsEyebrow: "AQUI NET TOOLS",
    explore: "Explore digital tools",
    categoryDescription: "Explore tools in this category.",
    allCategories: "All categories",
    filter: "Filter by category:",
    reset: "Reset",
    found: "tool(s) found",
    access: "Access:",
    platforms: "Platforms:",
    visit: "Visit official website →",
    empty: "No tools found. Try another search.",
    assistTitle: "Have a goal?",
    assistSubtitle: "Let's find the right tool.",
    assistDescription: "Describe your needs to discover relevant solutions.",
    learn: "LEARN",
    guides: "Guides, tutorials and digital resources.",
    develop: "GROW",
    services: "Digital services for your projects.",
    slogan: "Discover. Create. Progress."
  }
};

const categoryNames: Record<CategoryKey, { fr: string; en: string }> = {
  ai: { fr: "Intelligence artificielle", en: "Artificial intelligence" },
  content: { fr: "Création de contenu", en: "Content creation" },
  productivity: { fr: "Productivité", en: "Productivity" },
  learning: { fr: "Formation", en: "Education" },
  translation: { fr: "Traduction & langues", en: "Translation & languages" },
  development: { fr: "Développement", en: "Development" },
  marketing: { fr: "Marketing & visibilité", en: "Marketing & visibility" },
  business: { fr: "Commerce & activité en ligne", en: "E-commerce & online business" }
};

const categoryKeys: CategoryKey[] = [
  "ai",
  "content",
  "productivity",
  "learning",
  "translation",
  "development",
  "marketing",
  "business"
];

function App() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [category, setCategory] = useState<CategoryKey | "all">("all");

  const ui = translations[language];

  const filteredTools = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tools.filter((tool) => {
      const matchesCategory =
        category === "all" || tool.category === category;

      const matchesSearch =
        tool.name.toLowerCase().includes(term) ||
        tool.description[language].toLowerCase().includes(term) ||
        categoryNames[tool.category][language].toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [search, category, language]);

  const selectCategory = (item: CategoryKey) => {
    setCategory(item);

    window.setTimeout(() => {
      document.getElementById("tool-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 50);
  };

  return (
    <main className="site-shell" lang={language}>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>

        <nav aria-label={ui.navLabel}>
          <a href="#decouvrir">{ui.navDiscover}</a>
          <a href="#assist">{ui.navAssist}</a>
          <a href="#academy">{ui.navAcademy}</a>
          <a href="#business">{ui.navBusiness}</a>
        </nav>

        <button
          className="language-button"
          type="button"
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          aria-label={language === "fr" ? "Switch to English" : "Passer en français"}
        >
          {language === "fr" ? "EN" : "FR"}
        </button>
      </header>

      <section className="hero">
        <p className="eyebrow">{ui.eyebrow}</p>
        <h1>
          {ui.heroTitle}
          <br />
          <span>{ui.heroSubtitle}</span>
        </h1>
        <p className="hero-copy">{ui.heroDescription}</p>

        <form className="search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            placeholder={ui.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">{ui.searchButton}</button>
        </form>

        <p className="microcopy">{ui.microcopy}</p>
      </section>

      <section className="section" id="decouvrir">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{ui.toolsEyebrow}</p>
            <h2>{ui.explore}</h2>
          </div>
        </div>

        <div className="category-grid">
          {categoryKeys.map((item) => (
            <button
              className={`category-card${category === item ? " is-active" : ""}`}
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => selectCategory(item)}
            >
              <span className="card-symbol">✦</span>
              <h3>{categoryNames[item][language]}</h3>
              <p>{ui.categoryDescription}</p>
            </button>
          ))}
        </div>

        <div className="tool-filters" id="tool-results">
          <label htmlFor="category-filter">{ui.filter}</label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as CategoryKey | "all")
            }
          >
            <option value="all">{ui.allCategories}</option>
            {categoryKeys.map((item) => (
              <option key={item} value={item}>
                {categoryNames[item][language]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("all");
            }}
          >
            {ui.reset}
          </button>
        </div>

        <p className="results-count" aria-live="polite">
          {filteredTools.length} {ui.found}
        </p>

        <div className="tools-grid">
          {filteredTools.map((tool) => (
            <article className="tool-card" key={tool.name}>
              <p className="eyebrow">
                {categoryNames[tool.category][language]}
              </p>
              <h3>{tool.name}</h3>
              <p>{tool.description[language]}</p>
              <p>
                <strong>{ui.access}</strong> {tool.access[language]}
              </p>
              <p>
                <strong>{ui.platforms}</strong> {tool.platforms}
              </p>
              <a href={tool.url} target="_blank" rel="noreferrer">
                {ui.visit}
              </a>
            </article>
          ))}
        </div>

        {filteredTools.length === 0 && (
          <p>{ui.empty}</p>
        )}
      </section>

      <section className="assist-panel" id="assist">
        <div>
          <p className="eyebrow">AQUI NET ASSIST</p>
          <h2>
            {ui.assistTitle}
            <br />
            {ui.assistSubtitle}
          </h2>
          <p>{ui.assistDescription}</p>
        </div>
        <span className="assist-icon">✧</span>
      </section>

      <section className="section modules">
        <article id="academy">
          <p className="eyebrow">{ui.learn}</p>
          <h2>AQUI NET ACADEMY</h2>
          <p>{ui.guides}</p>
        </article>

        <article id="business">
          <p className="eyebrow">{ui.develop}</p>
          <h2>AQUI NET BUSINESS</h2>
          <p>{ui.services}</p>
        </article>
      </section>

      <footer>
        <a className="brand footer-brand" href="/">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>
        <p>{ui.slogan}</p>
        <small>© {new Date().getFullYear()} AQUI NET HUB</small>
      </footer>
    </main>
  );
}

export default App;
