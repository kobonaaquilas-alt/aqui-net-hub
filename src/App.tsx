import { useCallback, useEffect, useState } from "react";
import AccountHub from "./AccountHub";
import AdminPanel from "./AdminPanel";

type Campaign = { id: string; title: string; description: string; destination_url: string | null };

export default function App() {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adsenseClient, setAdsenseClient] = useState("");
  const fr = lang === "fr";
  const showAdmin = new URLSearchParams(window.location.search).get("admin") === "1";
  const syncRemote = useCallback((_favorites: string[], _progress: string[]) => {}, []);

  useEffect(() => {
    fetch("/api/public/campaigns")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const list = (data.campaigns || []) as Campaign[];
        setCampaigns(list);
        for (const campaign of list) {
          fetch(`/api/public/campaigns/${campaign.id}/impression`, { method: "POST" }).catch(() => {});
        }
      })
      .catch(() => {});
    fetch("/api/public/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setAdsenseClient(data.adsense_client || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!adsenseClient || !/^ca-pub-[0-9]{16}$/.test(adsenseClient) || document.querySelector("script[data-aqui-adsense]")) return;
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.aquiAdsense = "true";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + adsenseClient;
    document.head.appendChild(script);
  }, [adsenseClient]);

  const fallback: Campaign[] = [
    { id: "help-1", title: "AQUI NET HELP · Comprends tes statistiques", description: fr ? "Transforme tes données sociales en décisions concrètes." : "Turn social data into practical decisions.", destination_url: null },
    { id: "help-2", title: fr ? "Visibilité · Engagement · Croissance" : "Reach · Engagement · Growth", description: fr ? "Un diagnostic clair pour chaque créateur." : "A clear account diagnosis for every creator.", destination_url: null },
  ];
  const tickerItems = campaigns.length ? campaigns : fallback;

  return (
    <div className="site-shell help-shell">
      <header className="topbar">
        <a className="brand" href="#accueil" aria-label="AQUI NET HELP">
          <span className="brand-mark">A</span>
          <span>AQUI NET <strong>HELP</strong></span>
        </a>
        <nav className="main-nav" aria-label={fr ? "Navigation principale" : "Main navigation"}>
          <a href="#accueil">{fr ? "Accueil" : "Home"}</a>
          <a href="#diagnostic">{fr ? "Diagnostic" : "Audit"}</a>
          <a href="#fonctionnalites">{fr ? "Fonctionnalités" : "Features"}</a>
          <a href="#contact">{fr ? "Assistance" : "Support"}</a>
        </nav>
        <button className="language-button" onClick={() => setLang(fr ? "en" : "fr")}>{fr ? "EN" : "FR"}</button>
      </header>

      <section className="promo-ticker" aria-label={fr ? "Publicités et annonces" : "Advertisements and announcements"}>
        <div className="promo-track">
          {[...tickerItems, ...tickerItems].map((campaign, index) => (
            <a
              key={campaign.id + "-" + index}
              href={campaign.destination_url ? (campaign.id.startsWith("help-") ? campaign.destination_url : `/api/public/campaigns/${campaign.id}/click`) : "#diagnostic"}
              target={campaign.destination_url ? "_blank" : undefined}
              rel="noreferrer"
            >
              <span>✦</span> {campaign.title} <small>{campaign.description}</small>
              <b>{fr ? "Découvrir" : "Discover"} ↗</b>
            </a>
          ))}
        </div>
      </section>

      <main>
        <section className="hub-hero help-hero" id="accueil">
          <span className="eyebrow">AQUI NET HELP · SOCIAL INTELLIGENCE</span>
          <h1>{fr ? <>Fais grandir tes réseaux avec <span>des décisions intelligentes.</span></> : <>Grow your social presence with <span>smarter decisions.</span></>}</h1>
          <p>
            {fr
              ? "Analyse TikTok, Facebook, Instagram et YouTube. Comprends ce qui fonctionne, détecte ce qui bloque et reçois un plan d'action concret pour progresser."
              : "Analyze TikTok, Facebook, Instagram and YouTube. Understand what works, identify what holds you back and get a practical action plan."}
          </p>
          <a className="primary-button" href="#diagnostic">{fr ? "Analyser mon compte" : "Analyze my account"} ↗</a>
          <div className="help-platforms" aria-label="TikTok, Facebook, Instagram, YouTube">
            <span>TikTok</span><span>Facebook</span><span>Instagram</span><span>YouTube</span>
          </div>
        </section>

        <section className="help-value section" id="fonctionnalites">
          <div className="section-heading">
            <span className="eyebrow">ONE PLATFORM · FOUR NETWORKS</span>
            <h2>{fr ? "Un véritable copilote de croissance" : "A real growth co-pilot"}</h2>
            <p>{fr ? "Des indicateurs compréhensibles, des recommandations personnalisées et un suivi de progression." : "Understandable metrics, personalized recommendations and progress tracking."}</p>
          </div>
          <div className="help-feature-grid">
            <article className="help-feature"><span>01</span><h3>{fr ? "Diagnostic précis" : "Clear diagnosis"}</h3><p>{fr ? "Mesure l'engagement, la portée et la régularité à partir des données disponibles." : "Measure engagement, reach and consistency from available data."}</p></article>
            <article className="help-feature"><span>02</span><h3>{fr ? "Plan d'action ciblé" : "Targeted action plan"}</h3><p>{fr ? "Identifie les priorités et propose des actions adaptées à ton objectif." : "Prioritize improvements and get actions aligned with your goal."}</p></article>
            <article className="help-feature"><span>03</span><h3>{fr ? "Analyse multi-réseaux" : "Cross-platform analysis"}</h3><p>{fr ? "Centralise les diagnostics de tes comptes TikTok, Facebook, Instagram et YouTube." : "Bring TikTok, Facebook, Instagram and YouTube account audits together."}</p></article>
            <article className="help-feature"><span>04</span><h3>{fr ? "Monétisation" : "Monetization"}</h3><p>{fr ? "Repère les leviers de revenus, les pistes de partenariats et les points à améliorer." : "Identify revenue levers, partnership opportunities and areas to improve."}</p></article>
          </div>
        </section>

        <AccountHub service="social" favorites={[]} progress={[]} lang={lang} onRemoteSync={syncRemote} />

        <section className="help-contact section" id="contact">
          <div>
            <span className="eyebrow">AQUI NET HELP · CUSTOMER CARE</span>
            <h2>{fr ? "Besoin d'aide ou envie de soutenir le projet ?" : "Need help or want to support the project?"}</h2>
            <p>{fr ? "Notre assistance est disponible par WhatsApp et par e-mail. Les partenariats publicitaires et les propositions commerciales sont également les bienvenus." : "Reach support by WhatsApp or email. Advertising partnerships and business proposals are welcome."}</p>
          </div>
          <div className="help-contact-actions">
            <a className="primary-button" href="https://wa.me/22892244653?text=Bonjour%20AQUI%20NET%20HELP" target="_blank" rel="noreferrer">WhatsApp · +228 92 24 46 53 ↗</a>
            <a className="filter-button" href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a>
            <a className="filter-button" href="https://wa.me/22892244653?text=Je%20souhaite%20soutenir%20AQUI%20NET%20HELP" target="_blank" rel="noreferrer">{fr ? "Soutenir le projet" : "Support the project"} ↗</a>
          </div>
        </section>

        {showAdmin && <AdminPanel lang={lang} />}
      </main>

      <footer className="site-footer" id="footer">
        <a className="brand footer-brand" href="#accueil"><span className="brand-mark">A</span><span>AQUI NET <strong>HELP</strong></span></a>
        <p>{fr ? "Le copilote intelligent de tes réseaux sociaux." : "The intelligent co-pilot for your social media."}</p>
        <div className="footer-contact" id="footer-contact">
          <strong>{fr ? "Contact et assistance" : "Contact and support"}</strong>
          <a href="tel:+22892244653">+228 92 24 46 53</a>
          <a href="https://wa.me/22892244653" target="_blank" rel="noreferrer">WhatsApp</a>
          <a href="mailto:kobonaquilas@gmail.com">kobonaquilas@gmail.com</a>
        </div>
        <div className="footer-links"><a href="/terms">{fr ? "Conditions d'utilisation" : "Terms of use"}</a><a href="/privacy">{fr ? "Confidentialité" : "Privacy"}</a></div>
        <small>© {new Date().getFullYear()} AQUI NET HELP</small>
      </footer>
    </div>
  );
}
