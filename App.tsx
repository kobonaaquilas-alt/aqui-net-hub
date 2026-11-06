const categories = [
  { name: 'Intelligence artificielle', description: 'Outils pour créer, apprendre et travailler.' },
  { name: 'Création de contenu', description: 'Image, vidéo, audio et réseaux sociaux.' },
  { name: 'Productivité', description: 'Organisation, automatisation et travail.' },
  { name: 'Formation', description: 'Apprentissage et ressources numériques.' },
]

function App() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="AQUI NET HUB, accueil">
          <span className="brand-mark">A</span>
          <span>AQUI <strong>NET HUB</strong></span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#decouvrir">Découvrir</a>
          <a href="#assist">NET ASSIST</a>
          <a href="#academy">Academy</a>
          <a href="#business">Business</a>
        </nav>
        <button className="language-button" type="button">FR / EN</button>
      </header>

      <section className="hero">
        <p className="eyebrow">LE HUB DU NUMÉRIQUE</p>
        <h1>Le bon outil numérique.<br /><span>Au bon moment.</span></h1>
        <p className="hero-copy">
          Découvrez des outils, comparez leurs possibilités et trouvez les ressources
          adaptées à vos projets.
        </p>
        <form className="search" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="tool-search">Rechercher un outil</label>
          <input id="tool-search" type="search" placeholder="Que souhaitez-vous faire ?" />
          <button type="submit">Rechercher</button>
        </form>
        <p className="microcopy">Un répertoire accessible à tous, partout dans le monde.</p>
      </section>

      <section className="section" id="decouvrir">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORER</p>
            <h2>Découvrez les possibilités</h2>
          </div>
          <span className="section-note">AQUI NET TOOLS</span>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <article className="category-card" key={category.name}>
              <span className="card-symbol" aria-hidden="true">✦</span>
              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="assist-panel" id="assist">
        <div>
          <p className="eyebrow">AQUI NET ASSIST</p>
          <h2>Vous avez un objectif ?<br />Trouvons le bon outil.</h2>
          <p>Décrivez votre besoin en quelques mots. L'assistant vous orientera vers des solutions pertinentes.</p>
        </div>
        <span className="assist-icon" aria-hidden="true">✧</span>
      </section>

      <section className="section modules" aria-label="Autres services">
        <article id="academy"><p className="eyebrow">APPRENDRE</p><h2>AQUI NET ACADEMY</h2><p>Guides, tutoriels et ressources numériques.</p></article>
        <article id="business"><p className="eyebrow">DÉVELOPPER</p><h2>AQUI NET BUSINESS</h2><p>Des services numériques pour vos projets.</p></article>
      </section>

      <footer>
        <a className="brand footer-brand" href="/"><span className="brand-mark">A</span><span>AQUI <strong>NET HUB</strong></span></a>
        <p>Découvrir. Créer. Progresser.</p>
        <small>© {new Date().getFullYear()} AQUI NET HUB</small>
      </footer>
    </main>
  )
}

export default App
