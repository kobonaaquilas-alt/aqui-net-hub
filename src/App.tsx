import { useCallback, useMemo, useState } from "react";
import AccountHub from "./AccountHub";
import AdminPanel from "./AdminPanel";

const tools = [
  ["ChatGPT", "IA", "Assistant intelligent pour apprendre, écrire et créer.", "https://chatgpt.com/"],
  ["Gemini", "IA", "Assistant IA de Google.", "https://gemini.google.com/"],
  ["Copilot", "IA", "Assistant numérique de Microsoft.", "https://copilot.microsoft.com/"],
  ["Perplexity", "IA", "Recherche avec réponses et sources.", "https://www.perplexity.ai/"],
  ["Claude", "IA", "Assistant pour rédiger et analyser.", "https://claude.ai/"],
  ["DeepSeek", "IA", "Assistant IA polyvalent.", "https://chat.deepseek.com/"],
  ["Canva", "Design", "Création d'affiches, visuels et présentations.", "https://www.canva.com/"],
  ["Photopea", "Design", "Retouche d'images en ligne.", "https://www.photopea.com/"],
  ["Pixlr", "Design", "Édition et création graphique.", "https://pixlr.com/"],
  ["Remove.bg", "Design", "Suppression d'arrière-plan.", "https://www.remove.bg/"],
  ["CapCut", "Vidéo", "Montage vidéo pour les réseaux sociaux.", "https://www.capcut.com/"],
  ["VEED", "Vidéo", "Montage vidéo et sous-titres.", "https://www.veed.io/"],
  ["Clipchamp", "Vidéo", "Montage vidéo en ligne.", "https://clipchamp.com/"],
  ["Audacity", "Vidéo", "Enregistrement et traitement audio.", "https://www.audacityteam.org/"],
  ["Suno", "Vidéo", "Création musicale assistée par IA.", "https://suno.com/"],
  ["Google Docs", "Productivité", "Rédaction de documents.", "https://docs.google.com/"],
  ["Google Sheets", "Productivité", "Tableurs et calculs.", "https://sheets.google.com/"],
  ["Google Drive", "Productivité", "Stockage et partage de fichiers.", "https://drive.google.com/"],
  ["Notion", "Productivité", "Organisation des projets et notes.", "https://www.notion.so/"],
  ["Trello", "Productivité", "Gestion des tâches et projets.", "https://trello.com/"],
  ["WordPress", "Web", "Création de sites et blogs.", "https://wordpress.com/"],
  ["Google Sites", "Web", "Création de sites vitrines.", "https://sites.google.com/"],
  ["GitHub", "Web", "Hébergement et gestion de projets.", "https://github.com/"],
  ["Cloudflare", "Web", "Services web et hébergement.", "https://www.cloudflare.com/"],
  ["Khan Academy", "Formation", "Apprentissage gratuit.", "https://fr.khanacademy.org/"],
  ["Coursera", "Formation", "Cours en ligne.", "https://www.coursera.org/"],
  ["freeCodeCamp", "Formation", "Apprentissage de la programmation.", "https://www.freecodecamp.org/"],
  ["YouTube", "Formation", "Tutoriels et formations vidéo.", "https://www.youtube.com/"]
];

const paths = [
  {
    name: "Création de contenu",
    description: "Apprendre à créer des contenus numériques.",
    steps: ["Découvrir Canva", "Apprendre CapCut", "Préparer des scripts", "Publier ses créations"]
  },
  {
    name: "Compétences numériques",
    description: "Développer des compétences utiles sur Internet.",
    steps: ["Découvrir les outils numériques", "Apprendre les bases du web", "Créer un projet", "Présenter ses réalisations"]
  },
  {
    name: "Business en ligne",
    description: "Préparer progressivement une activité numérique.",
    steps: ["Identifier un besoin", "Définir une offre", "Créer une présence en ligne", "Tester son offre"]
  }
];

const businessSteps = [
  "Identifier un problème réel.",
  "Étudier les besoins des clients potentiels.",
  "Construire une offre claire.",
  "Créer une présence professionnelle.",
  "Tester son offre et recueillir des avis.",
  "Améliorer progressivement son service."
];

function readStorage(key: string): string[] {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tous");
  const [favorites, setFavorites] = useState<string[]>(() => readStorage("aqui-favorites"));
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [progress, setProgress] = useState<string[]>(() => readStorage("aqui-progress"));
  const [pathIndex, setPathIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const fr = lang === "fr";
  const syncRemote = useCallback((nextFavorites: string[], nextProgress: string[]) => { setFavorites(nextFavorites); setProgress(nextProgress); }, []);
  const categories = ["Tous", ...Array.from(new Set(tools.map(t => t[1])))];

  const visibleTools = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tools.filter(t => {
      const matches =
        !q || t.join(" ").toLowerCase().includes(q);
      const matchesCategory = category === "Tous" || t[1] === category;
      const matchesFavorite = !onlyFavorites || favorites.includes(t[0]);
      return matches && matchesCategory && matchesFavorite;
    });
  }, [search, category, onlyFavorites, favorites]);

  function toggleFavorite(name: string) {
    setFavorites(old => {
      const next = old.includes(name)
        ? old.filter(x => x !== name)
        : [...old, name];
      localStorage.setItem("aqui-favorites", JSON.stringify(next));
      return next;
    });
  }

  function toggleProgress(id: string) {
    setProgress(old => {
      const next = old.includes(id)
        ? old.filter(x => x !== id)
        : [...old, id];
      localStorage.setItem("aqui-progress", JSON.stringify(next));
      return next;
    });
  }

  function assist() {
    const q = question.toLowerCase().trim();
    if (!q) {
      setAnswer(fr ? "Décris ton objectif pour recevoir une orientation." : "Describe your goal to receive guidance.");
    } else if (/vidéo|video|tiktok|montage/.test(q)) {
      setAnswer(fr
        ? "Commence avec CapCut pour le montage, Canva pour les visuels et ChatGPT pour préparer tes scripts."
        : "Start with CapCut for editing, Canva for visuals and ChatGPT for scripts.");
    } else if (/argent|revenu|business|vente|commerce/.test(q)) {
      setAnswer(fr
        ? "Identifie une compétence, un besoin réel et des clients potentiels. Prépare une offre utile et teste-la avant d'investir. Aucun revenu n'est garanti."
        : "Identify a skill, a real need and potential customers. Prepare a useful offer and test it before investing. No income is guaranteed.");
    } else if (/site|web|application|code|programm/.test(q)) {
      setAnswer(fr
        ? "Explore freeCodeCamp, GitHub et Cloudflare. Commence par un petit projet fonctionnel."
        : "Explore freeCodeCamp, GitHub and Cloudflare. Start with a small working project.");
    } else if (/étud|etud|cours|formation|apprendre/.test(q)) {
      setAnswer(fr
        ? "Utilise Khan Academy, YouTube et Notion pour organiser ton apprentissage."
        : "Use Khan Academy, YouTube and Notion to organize your learning.");
    } else {
      setAnswer(fr
        ? "Décompose ton objectif en étapes simples. Compare les outils disponibles et commence par une solution adaptée à ton besoin."
        : "Break your goal into simple steps. Compare available tools and start with a solution that fits your needs.");
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#accueil">
          <span className="brand-mark">A</span>
          <span>AQUI NET <strong>HUB</strong></span>
        </a>
        <nav className="main-nav">
          <a href="#accueil">{fr ? "Accueil" : "Home"}</a>
          <a href="#outils">{fr ? "Outils" : "Tools"}</a>
          <a href="#academy">Academy</a>
          <a href="#business">Business</a>
          <a href="#compte">{fr ? "Compte" : "Account"}</a>
          <a href="#partenaires">{fr ? "Partenaires" : "Partners"}</a>
          <a href="#administration">{fr ? "Administration" : "Admin"}</a>
        </nav>
        <button className="language-button" onClick={() => setLang(fr ? "en" : "fr")}>
          {fr ? "EN" : "FR"}
        </button>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-content">
            <span className="eyebrow">AQUI NET HUB · DIGITAL OPPORTUNITIES</span>
            <h1>{fr ? "Le numérique ouvre des possibilités." : "Digital opens up possibilities."}</h1>
            <p>{fr
              ? "Découvre des outils, développe tes compétences et construis tes projets avec AQUI NET HUB."
              : "Discover tools, develop your skills and build your projects with AQUI NET HUB."}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#outils">{fr ? "Explorer les outils" : "Explore tools"}</a>
              <a className="secondary-button" href="#academy">{fr ? "Découvrir l'académie" : "Explore academy"}</a>
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
          <div className="stat-card"><strong>{tools.length}</strong><span>{fr ? "Outils numériques" : "Digital tools"}</span></div>
          <div className="stat-card"><strong>{categories.length - 1}</strong><span>{fr ? "Domaines" : "Categories"}</span></div>
          <div className="stat-card"><strong>24/7</strong><span>{fr ? "Accès en ligne" : "Online access"}</span></div>
        </section>

        <section className="section tools-section" id="outils">
          <div className="section-heading">
            <span className="eyebrow">AQUI NET TOOLS</span>
            <h2>{fr ? "Explore les outils" : "Explore the tools"}</h2>
            <p>{fr ? "Des ressources numériques pour apprendre, créer et entreprendre." : "Digital resources to learn, create and build."}</p>
          </div>

          <div className="tools-controls">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={fr ? "Rechercher un outil..." : "Search for a tool..."}
            />
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c === "Tous" ? (fr ? "Toutes les catégories" : "All categories") : c}</option>)}
            </select>
            <button className={onlyFavorites ? "filter-button active" : "filter-button"} onClick={() => setOnlyFavorites(v => !v)}>
              ♥ {fr ? "Mes favoris" : "Favorites"} ({favorites.length})
            </button>
          </div>

          <p className="tools-count">{visibleTools.length} {fr ? "outil(s) disponible(s)" : "available tools"}</p>

          {visibleTools.length ? (
            <div className="tools-grid">
              {visibleTools.map(t => (
                <article className="tool-card" key={t[0]}>
                  <div className="tool-card-top">
                    <span className="tool-icon">{t[0].charAt(0)}</span>
                    <button className={favorites.includes(t[0]) ? "favorite-button selected" : "favorite-button"} onClick={() => toggleFavorite(t[0])}>
                      {favorites.includes(t[0]) ? "♥" : "♡"}
                    </button>
                  </div>
                  <span className="tool-category">{t[1]}</span>
                  <h3>{t[0]}</h3>
                  <p>{t[2]}</p>
                  <div className="tool-card-bottom">
                    <span className="free-label">{fr ? "Accès gratuit*" : "Free access*"}</span>
                    <a href={t[3]} target="_blank" rel="noopener noreferrer">{fr ? "Ouvrir" : "Open"} ↗</a>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state">{fr ? "Aucun outil trouvé." : "No tools found."}</div>}
          <p className="business-note">{fr ? "*Certains outils proposent aussi des options payantes. Consulte leurs conditions officielles." : "*Some tools also offer paid features. Check their official terms."}</p>
        </section>

        <section className="section assist-section" id="assistant">
          <div className="assist-content">
            <span className="eyebrow">YOUR DIGITAL GUIDE</span>
            <h2>NET ASSIST</h2>
            <p>{fr ? "Décris ton objectif. NET ASSIST te propose une première orientation." : "Describe your goal. NET ASSIST suggests a starting point."}</p>
            <textarea rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder={fr ? "Exemple : je veux créer des vidéos pour TikTok..." : "Example: I want to create videos for TikTok..."} />
            <button className="primary-button" onClick={assist}>{fr ? "Obtenir une orientation" : "Get guidance"}</button>
            {answer && <div className="assist-result"><strong>{fr ? "Orientation" : "Guidance"}</strong><p>{answer}</p></div>}
          </div>
          <div className="assist-symbol" aria-hidden="true">✦</div>
        </section>

        <section className="section academy-section" id="academy">
          <div className="section-heading">
            <span className="eyebrow">LEARN · PRACTICE · GROW</span>
            <h2>AQUI NET ACADEMY</h2>
            <p>{fr ? "Des parcours simples pour développer tes compétences." : "Simple paths to develop your skills."}</p>
          </div>
          <div className="academy-layout">
            <div className="academy-paths">
              {paths.map((p, i) => (
                <button key={p.name} className={pathIndex === i ? "path-button active" : "path-button"} onClick={() => setPathIndex(i)}>
                  <span>0{i + 1}</span><strong>{p.name}</strong><small>{p.description}</small>
                </button>
              ))}
            </div>
            <div className="academy-detail">
              <span className="eyebrow">{fr ? "TON PARCOURS" : "YOUR PATH"}</span>
              <h3>{paths[pathIndex].name}</h3>
              <p>{paths[pathIndex].description}</p>
              <div className="progress-list">
                {paths[pathIndex].steps.map((step, i) => {
                  const id = `${pathIndex}-${i}`;
                  return (
                    <label className="progress-item" key={id}>
                      <input type="checkbox" checked={progress.includes(id)} onChange={() => toggleProgress(id)} />
                      <span className={progress.includes(id) ? "completed" : ""}>{step}</span>
                    </label>
                  );
                })}
              </div>
              <p className="progress-summary">{progress.filter(x => x.startsWith(`${pathIndex}-`)).length}/{paths[pathIndex].steps.length} {fr ? "étapes terminées" : "steps completed"}</p>
            </div>
          </div>
        </section>

        <section className="section business-section" id="business">
          <div className="section-heading">
            <span className="eyebrow">IDEAS INTO ACTION</span>
            <h2>{fr ? "Construis ton projet." : "Build your project."}</h2>
            <p>{fr ? "Une méthode progressive pour transformer une idée en activité structurée." : "A gradual method to turn an idea into a structured activity."}</p>
          </div>
          <div className="business-steps">
            {businessSteps.map((s, i) => <div className="business-step" key={s}><span>{String(i + 1).padStart(2, "0")}</span><p>{s}</p></div>)}
          </div>
          <p className="business-note">{fr ? "AQUI NET HUB ne garantit aucun revenu. Les résultats dépendent du marché, du travail et de la qualité de l'offre." : "AQUI NET HUB does not guarantee income. Results depend on the market, effort and offer quality."}</p>
        </section>

        <AccountHub favorites={favorites} progress={progress} lang={lang} onRemoteSync={syncRemote} />

        <AdminPanel />

        <section className="section promotion-grid" id="partenaires">
          <article className="promotion-card">
            <span className="eyebrow">AQUI NET ADS</span>
            <h2>{fr ? "Publicité" : "Advertising"}</h2>
            <p>{fr ? "Propose une campagne depuis ton espace membre. Chaque demande est examinée par notre équipe avant publication." : "Submit an advertising campaign from your member account. Each request is reviewed by our team before publication."}</p>
            <span className="status-label">{fr ? "Demandes ouvertes" : "Requests open"}</span>
          </article>
          <article className="promotion-card partner-card">
            <span className="eyebrow">AQUI NET PARTNERS</span>
            <h2>{fr ? "Partenaires et collaborations" : "Partners and collaborations"}</h2>
            <p>{fr ? "Propose une collaboration depuis ton espace membre. Notre équipe examinera ta candidature." : "Submit a partnership proposal from your member account. Our team will review your application."}</p>
            <span className="status-label">{fr ? "Demandes ouvertes" : "Requests open"}</span>
          </article>
        </section>

        <section className="section faq-section" id="faq">
          <div className="section-heading"><span className="eyebrow">HELP CENTER</span><h2>{fr ? "Questions fréquentes" : "Frequently asked questions"}</h2></div>
          <details><summary>{fr ? "Les outils sont-ils gratuits ?" : "Are the tools free?"}</summary><p>{fr ? "Les outils référencés proposent un accès gratuit ou une formule gratuite. Certaines fonctions peuvent être payantes." : "Listed tools offer free access or a free plan. Some features may require payment."}</p></details>
          <details><summary>{fr ? "Où sont enregistrés mes favoris ?" : "Where are my favorites saved?"}</summary><p>{fr ? "Sans compte, ils restent sur cet appareil. Avec un compte, ils sont synchronisés en ligne." : "They are stored locally in this device's browser."}</p></details>
          <details><summary>{fr ? "Ma progression est-elle synchronisée ?" : "Is my progress synchronized?"}</summary><p>{fr ? "Avec un compte, elle est synchronisée en ligne. Sans compte, elle reste enregistrée sur cet appareil." : "No. It is stored locally on this device, without an online account."}</p></details>
          <details><summary>{fr ? "AQUI NET HUB garantit-il des revenus ?" : "Does AQUI NET HUB guarantee income?"}</summary><p>{fr ? "Non. La plateforme fournit des ressources et des orientations, mais aucun revenu n'est garanti." : "No. The platform provides resources and guidance, but no income is guaranteed."}</p></details>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#accueil"><span className="brand-mark">A</span><span>AQUI NET <strong>HUB</strong></span></a>
        <p>{fr ? "Une plateforme pour apprendre, créer et avancer dans le monde numérique." : "A platform to learn, create and move forward in the digital world."}</p>
        <div className="footer-links">
          <a href="#accueil">{fr ? "Accueil" : "Home"}</a>
          <a href="#outils">{fr ? "Outils" : "Tools"}</a>
          <a href="#academy">Academy</a>
          <a href="#faq">FAQ</a>
        </div>
        <small>© {new Date().getFullYear()} AQUI NET HUB. {fr ? "Tous droits réservés." : "All rights reserved."}</small>
      </footer>
    </div>
  );
                                                                                                            }
