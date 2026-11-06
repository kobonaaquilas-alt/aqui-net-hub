import { useMemo, useState } from "react";

type Tool = {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  free: boolean;
  tag?: string;
};

const tools: Tool[] = [
  { id: "chatgpt", name: "ChatGPT", category: "Intelligence artificielle", description: "Assistant IA pour écrire, apprendre, analyser et créer.", url: "https://chatgpt.com/", free: true, tag: "Populaire" },
  { id: "gemini", name: "Google Gemini", category: "Intelligence artificielle", description: "Assistant intelligent de Google.", url: "https://gemini.google.com/", free: true },
  { id: "copilot", name: "Microsoft Copilot", category: "Intelligence artificielle", description: "Assistant IA pour les recherches et la productivité.", url: "https://copilot.microsoft.com/", free: true },
  { id: "perplexity", name: "Perplexity", category: "Intelligence artificielle", description: "Recherche intelligente avec des sources.", url: "https://www.perplexity.ai/", free: true },
  { id: "claude", name: "Claude", category: "Intelligence artificielle", description: "Assistant IA pour la rédaction et l'analyse.", url: "https://claude.ai/", free: true },
  { id: "deepseek", name: "DeepSeek", category: "Intelligence artificielle", description: "Assistant IA polyvalent.", url: "https://chat.deepseek.com/", free: true },

  { id: "canva", name: "Canva", category: "Création graphique", description: "Conçois des affiches, visuels, présentations et publications.", url: "https://www.canva.com/", free: true },
  { id: "photopea", name: "Photopea", category: "Création graphique", description: "Éditeur graphique en ligne.", url: "https://www.photopea.com/", free: true },
  { id: "removebg", name: "Remove.bg", category: "Création graphique", description: "Supprime automatiquement l'arrière-plan d'une image.", url: "https://www.remove.bg/", free: true },
  { id: "pixlr", name: "Pixlr", category: "Création graphique", description: "Retouche et création d'images en ligne.", url: "https://pixlr.com/", free: true },

  { id: "capcut", name: "CapCut", category: "Vidéo et audio", description: "Montage vidéo pour les réseaux sociaux.", url: "https://www.capcut.com/", free: true, tag: "Créateurs" },
  { id: "clipchamp", name: "Clipchamp", category: "Vidéo et audio", description: "Montage vidéo simple dans le navigateur.", url: "https://clipchamp.com/", free: true },
  { id: "veed", name: "VEED", category: "Vidéo et audio", description: "Montage vidéo, sous-titres et outils IA.", url: "https://www.veed.io/", free: true },
  { id: "audacity", name: "Audacity", category: "Vidéo et audio", description: "Logiciel gratuit d'enregistrement et de traitement audio.", url: "https://www.audacityteam.org/", free: true },
  { id: "suno", name: "Suno", category: "Vidéo et audio", description: "Création musicale assistée par intelligence artificielle.", url: "https://suno.com/", free: true },

  { id: "google-docs", name: "Google Docs", category: "Productivité", description: "Rédige et partage des documents en ligne.", url: "https://docs.google.com/", free: true },
  { id: "google-sheets", name: "Google Sheets", category: "Productivité", description: "Crée des tableaux et réalise des calculs.", url: "https://sheets.google.com/", free: true },
  { id: "notion", name: "Notion", category: "Productivité", description: "Organise tes projets, notes et activités.", url: "https://www.notion.so/", free: true },
  { id: "trello", name: "Trello", category: "Productivité", description: "Organise le travail avec des tableaux de tâches.", url: "https://trello.com/", free: true },
  { id: "drive", name: "Google Drive", category: "Productivité", description: "Stocke et partage tes fichiers en ligne.", url: "https://drive.google.com/", free: true },

  { id: "wordpress", name: "WordPress", category: "Business et création web", description: "Crée un site web ou un blog.", url: "https://wordpress.com/", free: true },
  { id: "google-sites", name: "Google Sites", category: "Business et création web", description: "Crée facilement un site vitrine.", url: "https://sites.google.com/", free: true },
  { id: "github", name: "GitHub", category: "Business et création web", description: "Héberge et gère tes projets numériques.", url: "https://github.com/", free: true },
  { id: "cloudflare", name: "Cloudflare", category: "Business et création web", description: "Services web, sécurité et hébergement.", url: "https://www.cloudflare.com/", free: true },

  { id: "khan", name: "Khan Academy", category: "Formation", description: "Apprends gratuitement de nombreuses matières.", url: "https://fr.khanacademy.org/", free: true },
  { id: "coursera", name: "Coursera", category: "Formation", description: "Cours en ligne proposés par des institutions.", url: "https://www.coursera.org/", free: true },
  { id: "freecodecamp", name: "freeCodeCamp", category: "Formation", description: "Apprends gratuitement la programmation.", url: "https://www.freecodecamp.org/", free: true },
  { id: "youtube", name: "YouTube", category: "Formation", description: "Trouve des tutoriels et des formations vidéo.", url: "https://www.youtube.com/", free: true }
];

const categories = [
  "Toutes les catégories",
  ...Array.from(new Set(tools.map((tool) => tool.category)))
];

const learningPaths = [
  {
    title: "Création de contenu",
    description: "Apprends à produire des vidéos, des visuels et des publications.",
    steps: ["Découvrir Canva", "Apprendre le montage avec CapCut", "Utiliser une IA pour préparer ses contenus", "Publier régulièrement"]
  },
  {
    title: "Compétences numériques",
    description: "Développe des compétences utiles pour travailler sur Internet.",
    steps: ["Découvrir les outils numériques", "Apprendre les bases du web", "Créer un premier projet", "Constituer un portfolio"]
  },
  {
    title: "Création d'activité en ligne",
    description: "Prépare une activité numérique avec une approche progressive.",
    steps: ["Identifier un besoin réel", "Définir une offre utile", "Créer une présence en ligne", "Tester son offre auprès de clients"]
  }
];

const businessSteps = [
  "Identifier un problème réel à résoudre.",
  "Étudier les personnes qui pourraient avoir besoin de la solution.",
  "Construire une offre simple et compréhensible.",
  "Créer une présence professionnelle en ligne.",
  "Tester l'offre et recueillir les retours.",
  "Améliorer le service avant d'investir davantage."
];

function App() {
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Toutes les catégories");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("aqui-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [showFavorites, setShowFavorites] = useState(false);
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("aqui-progress") || "[]");
    } catch {
      return [];
    }
  });
  const [activePath, setActivePath] = useState(0);
  const [assistQuestion, setAssistQuestion] = useState("");
  const [assistResult, setAssistResult] = useState("");

  const isFr = language === "fr";

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tools.filter((tool) => {
      const matchesSearch =
        !query ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query);

      const matchesCategory =
        category === "Toutes les catégories" || tool.category === category;

      const matchesFavorite =
        !showFavorites || favorites.includes(tool.id);

      return matchesSearch && matchesCategory && matchesFavorite;
    });
  }, [search, category, showFavorites, favorites]);

  function toggleFavorite(id: string) {
    setFavorites((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];

      localStorage.setItem("aqui-favorites", JSON.stringify(next));
      return next;
    });
  }

  function toggleProgress(id: string) {
    setCompleted((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];

      localStorage.setItem("aqui-progress", JSON.stringify(next));
      return next;
    });
  }

  function getRecommendation() {
    const question = assistQuestion.trim();

    if (!question) {
      setAssistResult(
        isFr
          ? "Décris ton objectif pour recevoir une orientation."
          : "Describe your goal to receive guidance."
      );
      return;
    }

    const q = question.toLowerCase();

    if (/vidéo|video|tiktok|youtube|montage|film/.test(q)) {
      setAssistResult(
        isFr
          ? "Pour créer des vidéos, commence avec CapCut pour le montage, Canva pour les visuels et ChatGPT pour préparer tes scripts."
          : "For video creation, start with CapCut for editing, Canva for visuals and ChatGPT for scripts."
      );
    } else if (/argent|revenu|business|commerce|vente|entreprise/.test(q)) {
      setAssistResult(
        isFr
          ? "Commence par identifier une compétence que tu peux proposer, un besoin réel et des clients potentiels. Utilise Canva pour présenter ton offre et Google Docs pour préparer ton plan. Les revenus ne sont jamais garantis."
          : "Start by identifying a skill you can offer, a real need and potential customers. Use Canva to present your offer and Google Docs to prepare your plan. Income is never guaranteed."
      );
    } else if (/site|web|application|code|program/.test(q)) {
      setAssistResult(
        isFr
          ? "Pour créer un projet web, découvre freeCodeCamp, GitHub et Cloudflare. Commence par un petit projet fonctionnel avant d'ajouter des fonctionnalités."
          : "To build a web project, explore freeCodeCamp, GitHub and Cloudflare. Start with a small working project before adding features."
      );
    } else if (/étud|etud|cours|formation|apprendre|school/.test(q)) {
      setAssistResult(
        isFr
          ? "Pour apprendre, utilise Khan Academy pour les cours, YouTube pour les tutoriels et Notion pour organiser tes révisions."
          : "For learning, use Khan Academy for lessons, YouTube for tutorials and Notion to organize your study."
      );
    } else if (/image|photo|design|affiche|logo/.test(q)) {
      setAssistResult(
        isFr
          ? "Pour créer des visuels, commence avec Canva. Photopea et Pixlr peuvent ensuite t'aider à retoucher tes images."
          : "For visuals, start with Canva. Photopea and Pixlr can help you edit images."
      );
    } else {
      setAssistResult(
        isFr
          ? "Décompose ton objectif en petites étapes. Explore les outils de la plateforme, compare leurs possibilités et commence par une solution gratuite adaptée à ton besoin."
          : "Break your goal into small steps. Explore the platform's tools, compare their features and start with a free solution that fits your needs."
      );
    }
  }

  const translations = {
    home: isFr ? "Accueil" : "Home",
    tools: isFr ? "Outils" : "Tools",
    academy: isFr ? "Académie" : "Academy",
    business: isFr ? "Business" : "Business",
    partners: isFr ? "Partenaires" : "Partners",
    heroTitle: isFr ? "Le numérique ouvre des possibilités." : "Digital opens up possibilities.",
    heroText: isFr
      ? "Découvre des outils, développe tes compétences et construis tes projets avec AQUI NET HUB."
      : "Discover tools, develop your skills and build your projects with AQUI NET HUB.",
    explore: isFr ? "Explorer les outils" : "Explore tools",
    discover: isFr ? "Découvrir l'académie" : "Explore the academy",
    search: isFr ? "Rechercher un outil..." : "Search for a tool...",
    all: isFr ? "Toutes les catégories" : "All categories",
    favorites: isFr ? "Mes favoris" : "My favorites",
    allTools: isFr ? "Tous les outils" : "All tools",
    noResults: isFr ? "Aucun outil trouvé." : "No tools found.",
    free: isFr ? "Accès gratuit" : "Free access",
    open: isFr ? "Ouvrir l'outil" : "Open tool",
    assistant: isFr ? "NET ASSIST" : "NET ASSIST",
    assistantText: isFr
      ? "Décris ce que tu souhaites accomplir. NET ASSIST te propose une première orientation."
      : "Describe what you want to achieve. NET ASSIST will suggest a starting point.",
    send: isFr ? "Obtenir une orientation" : "Get guidance",
    academyTitle: isFr ? "AQUI NET ACADEMY" : "AQUI NET ACADEMY",
    businessTitle: isFr ? "Construis ton projet." : "Build your project.",
    businessText: isFr
      ? "Une démarche progressive pour transformer une idée en activité structurée."
      : "A gradual approach to turn an idea into a structured activity.",
    partnersTitle: isFr ? "Partenaires et collaborations" : "Partners and collaborations",
    partnersText: isFr
      ? "Cette rubrique est destinée à accueillir des collaborations, ressources et offres professionnelles vérifiées."
      : "This section is intended for verified collaborations, resources and professional offers.",
    adsTitle: isFr ? "AQUI NET ADS" : "AQUI NET ADS",
    adsText: isFr
      ? "Un espace prévu pour présenter des offres et des services utiles. Les campagnes publicitaires ne sont pas encore ouvertes."
      : "A space planned for useful offers and services. Advertising campaigns are not yet open.",
    faqTitle: isFr ? "Questions fréquentes" : "Frequently asked questions",
    footer: isFr
      ? "Une plateforme pour apprendre, créer et avancer dans le monde numérique."
      : "A platform to learn, create and move forward in the digital world."
  };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#accueil" aria-label="AQUI NET HUB">
          <span className="brand-mark">A</span>
          <span>AQUI NET <strong>HUB</strong></span>
        </a>

        <nav className="main-nav">
          <a href="#accueil">{translations.home}</a>
          <a href="#outils">{translations.tools}</a>
          <a href="#academy">{translations.academy}</a>
          <a href="#business">{translations.business}</a>
          <a href="#partenaires">{translations.partners}</a>
        </nav>

        <button
          className="language-button"
          onClick={() => setLanguage(isFr ? "en" : "fr")}
          type="button"
        >
          {isFr ? "EN" : "FR"}
        </button>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-content">
            <span className="eyebrow">AQUI NET HUB · DIGITAL OPPORTUNITIES</span>
            <h1>{translations.heroTitle}</h1>
            <p>{translations.heroText}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#outils">{translations.explore}</a>
              <a className="secondary-button" href="#academy">{translations.discover}</a>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-center">AQUI<br />NET<br /><strong>HUB</strong></div>
            <span className="visual-chip chip-one">AI</span>
            <span className="visual-chip chip-two">WEB</span>
            <span className="visual-chip chip-three">CREATE</span>
          </div>
        </section>

        <section className="stats-section">
          <div className="stat-card">
            <strong>{tools.length}+</strong>
            <span>{isFr ? "Outils numériques" : "Digital tools"}</span>
          </div>
          <div className="stat-card">
            <strong>{categories.length - 1}</strong>
            <span>{isFr ? "Domaines" : "Categories"}</span>
          </div>
          <div className="stat-card">
            <strong>100%</strong>
            <span>{isFr ? "Accessible en ligne" : "Available online"}</span>
          </div>
        </section>

        <section className="section tools-section" id="outils">
          <div className="section-heading">
            <span className="eyebrow">AQUI NET TOOLS</span>
            <h2>{translations.tools}</h2>
            <p>
              {isFr
                ? "Une sélection d'outils pour apprendre, créer et développer tes projets."
                : "A selection of tools to learn, create and develop your projects."}
            </p>
          </div>

          <div className="tools-controls">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={translations.search}
              aria-label={translations.search}
            />

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label={translations.all}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "Toutes les catégories" ? translations.all : item}
                </option>
              ))}
            </select>

            <button
              className={showFavorites ? "filter-button active" : "filter-button"}
              onClick={() => setShowFavorites((value) => !value)}
              type="button"
            >
              ♥ {translations.favorites} ({favorites.length})
            </button>
          </div>

          <div className="tools-count">
            {filteredTools.length} {isFr ? "outil(s) disponible(s)" : "tool(s) available"}
          </div>

          {filteredTools.length > 0 ? (
            <div className="tools-grid">
              {filteredTools.map((tool) => (
                <article className="tool-card" key={tool.id}>
                  <div className="tool-card-top">
                    <span className="tool-icon">{tool.name.charAt(0)}</span>
                    <button
                      className={favorites.includes(tool.id) ? "favorite-button selected" : "favorite-button"}
                      onClick={() => toggleFavorite(tool.id)}
                      type="button"
                      aria-label={isFr ? "Ajouter ou retirer des favoris" : "Toggle favorite"}
                    >
                      {favorites.includes(tool.id) ? "♥" : "♡"}
                    </button>
                  </div>
                  <span className="tool-category">{tool.category}</span>
                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>
                  <div className="tool-card-bottom">
                    <span className="free-label">{translations.free}</span>
                    <a href={tool.url} target="_blank" rel="noopener noreferrer">
                      {translations.open} ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">{translations.noResults}</div>
          )}
        </section>

        <section className="section assist-section" id="assistant">
          <div className="assist-content">
            <span className="eyebrow">YOUR DIGITAL GUIDE</span>
            <h2>{translations.assistant}</h2>
            <p>{translations.assistantText}</p>
            <textarea
              value={assistQuestion}
              onChange={(event) => setAssistQuestion(event.target.value)}
              placeholder={
                isFr
                  ? "Exemple : je veux créer des vidéos pour TikTok..."
                  : "Example: I want to create videos for TikTok..."
              }
              rows={3}
            />
            <button className="primary-button" t
