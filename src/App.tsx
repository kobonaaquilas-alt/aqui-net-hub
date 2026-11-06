import { useMemo, useState } from "react";


const tools = [
  // Intelligence artificielle
  { name: "ChatGPT", category: "Intelligence artificielle", description: "Assistant IA pour rédiger, apprendre, analyser et créer.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://chatgpt.com/" },
  { name: "Gemini", category: "Intelligence artificielle", description: "Assistant IA de Google pour la recherche et la création.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://gemini.google.com/" },
  { name: "Claude", category: "Intelligence artificielle", description: "Assistant IA pour écrire, analyser et travailler.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://claude.ai/" },
  { name: "Perplexity", category: "Intelligence artificielle", description: "Moteur de recherche IA qui fournit des réponses accompagnées de sources.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.perplexity.ai/" },
  { name: "Microsoft Copilot", category: "Intelligence artificielle", description: "Assistant IA pour les questions, la rédaction et la création.", access: "Gratuit avec options payantes", platforms: "Web · Android · iOS · Windows", url: "https://copilot.microsoft.com/" },

  // Création de contenu
  { name: "Canva", category: "Création de contenu", description: "Création de visuels, présentations et contenus graphiques.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.canva.com/" },
  { name: "CapCut", category: "Création de contenu", description: "Montage vidéo et création de contenus pour les réseaux sociaux.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.capcut.com/" },
  { name: "Photopea", category: "Création de contenu", description: "Éditeur graphique en ligne pour les images.", access: "Gratuit avec publicité", platforms: "Web", url: "https://www.photopea.com/" },
  { name: "Adobe Express", category: "Création de contenu", description: "Création de visuels, affiches, vidéos et publications pour les réseaux sociaux.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.adobe.com/express/" },
  { name: "OBS Studio", category: "Création de contenu", description: "Enregistrement vidéo et diffusion en direct depuis un ordinateur.", access: "Gratuit", platforms: "Windows · macOS · Linux", url: "https://obsproject.com/" },

  // Productivité
  { name: "Notion", category: "Productivité", description: "Organisation du travail, notes et gestion de projets.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.notion.com/" },
  { name: "Trello", category: "Productivité", description: "Organisation des tâches et suivi des projets.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://trello.com/" },
  { name: "Grammarly", category: "Productivité", description: "Correction grammaticale et amélioration de textes, notamment en anglais.", access: "Freemium", platforms: "Web · Extensions", url: "https://www.grammarly.com/" },
  { name: "Google Drive", category: "Productivité", description: "Stockage, partage et organisation de fichiers en ligne.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://drive.google.com/" },

  // Formation
  { name: "Khan Academy", category: "Formation", description: "Cours et exercices pour apprendre gratuitement.", access: "Gratuit", platforms: "Web · Android · iOS", url: "https://www.khanacademy.org/" },
  { name: "freeCodeCamp", category: "Formation", description: "Apprentissage gratuit de la programmation.", access: "Gratuit", platforms: "Web", url: "https://www.freecodecamp.org/" },
  { name: "Coursera", category: "Formation", description: "Cours en ligne proposés par des universités et des entreprises.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.coursera.org/" },
  { name: "Duolingo", category: "Formation", description: "Apprentissage des langues avec des exercices interactifs.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.duolingo.com/" },

  // Traduction et langues
  { name: "DeepL", category: "Traduction & langues", description: "Traduction de textes et de documents dans plusieurs langues.", access: "Freemium", platforms: "Web · Android · iOS", url: "https://www.deepl.com/translator" },

  // Développement
  { name: "GitHub Copilot", category: "Développement", description: "Assistant IA pour écrire, comprendre et améliorer du code.", access: "Freemium", platforms: "Web · IDE", url: "https://github.com/features/copilot" },
];

const categories = [
  "Toutes les catégories",
  "Intelligence artificielle",
  "Création de contenu",
  "Productivité",
  "Formation",
  "Traduction & langues",
  "Développement",
];


function App() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [category, setCategory] = useState("Toutes les catégories");

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const matchesCategory =
        category === "Toutes les catégories" || tool.category === category;

      const term = search.toLowerCase();
      const matchesSearch =
        tool.name.toLowerCase().includes(term) ||
        tool.description.toLowerCase().includes(term) ||
        tool.category.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#decouvrir">Découvrir</a>
          <a href="#assist">NET ASSIST</a>
          <a href="#academy">Academy</a>
          <a href="#business">Business</a>
        </nav>
        <button
  className="language-button"
  type="button"
  onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
>
  {language === "fr" ? "FR / EN" : "EN / FR"}
</button>
      </header>

      <section className="hero">
        <p className="eyebrow">LE HUB DU NUMÉRIQUE</p>
        <h1>Le bon outil numérique.<br /><span>Au bon moment.</span></h1>
        <p className="hero-copy">
          Découvrez des outils, comparez leurs possibilités et trouvez les ressources adaptées à vos projets.
        </p>
        <form className="search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            placeholder="Rechercher un outil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Rechercher</button>
        </form>
        <p className="microcopy">Un répertoire accessible à tous, partout dans le monde.</p>
      </section>

      <section className="section" id="decouvrir">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AQUI NET TOOLS</p>
            <h2>Explorez les outils numériques</h2>
          </div>
        </div>

        <div className="category-grid">
          {categories.slice(1).map((item) => (
            <button
              className="category-card"
              key={item}
              type="button"
              onClick={() => setCategory(item)}
            >
              <span className="card-symbol">✦</span>
              <h3>{item}</h3>
              <p>Explorer les outils de cette catégorie.</p>
            </button>
          ))}
        </div>

        <div className="tool-filters">
          <label htmlFor="category-filter">Filtrer par catégorie :</label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button type="button" onClick={() => { setSearch(""); setCategory("Toutes les catégories"); }}>
            Réinitialiser
          </button>
        </div>

        <p className="results-count">{filteredTools.length} outil(s) trouvé(s)</p>

        <div className="tools-grid">
          {filteredTools.map((tool) => (
            <article className="tool-card" key={tool.name}>
              <p className="eyebrow">{tool.category}</p>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
              <p><strong>Accès :</strong> {tool.access}</p>
              <p><strong>Plateformes :</strong> {tool.platforms}</p>
              <a href={tool.url} target="_blank" rel="noreferrer">
                Visiter le site officiel →
              </a>
            </article>
          ))}
        </div>

        {filteredTools.length === 0 && (
          <p>Aucun outil trouvé. Essayez une autre recherche.</p>
        )}
      </section>

      <section className="assist-panel" id="assist">
        <div>
          <p className="eyebrow">AQUI NET ASSIST</p>
          <h2>Vous avez un objectif ?<br />Trouvons le bon outil.</h2>
          <p>Décrivez votre besoin pour découvrir des solutions pertinentes.</p>
        </div>
        <span className="assist-icon">✧</span>
      </section>

      <section className="section modules">
        <article id="academy">
          <p className="eyebrow">APPRENDRE</p>
          <h2>AQUI NET ACADEMY</h2>
          <p>Guides, tutoriels et ressources numériques.</p>
        </article>
        <article id="business">
          <p className="eyebrow">DÉVELOPPER</p>
          <h2>AQUI NET BUSINESS</h2>
          <p>Des services numériques pour vos projets.</p>
        </article>
      </section>

      <footer>
        <a className="brand footer-brand" href="/">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>
        <p>Découvrir. Créer. Progresser.</p>
        <small>© {new Date().getFullYear()} AQUI NET HUB</small>
      </footer>
    </main>
  );
}

export default App;
