import { useCallback, useEffect, useMemo, useState } from "react";
import AccountHub from "./AccountHub";
import AdminPanel from "./AdminPanel";

type Service = "tools" | "video" | "social" | "partners";
type Campaign = {id:string;title:string;description:string;destination_url:string|null};
type Tool = { name:string; category:string; description:string; url:string; keywords:string[]; how:string[]; benefits:string[] };
const tools:Tool[] = [
  {name:"ChatGPT",category:"Assistant IA",description:"Préparer des idées, des scripts, des textes et des plans de travail.",url:"https://chatgpt.com/",keywords:["idee","idée","texte","script","ecrire","écrire","rediger","rédiger","plan","apprendre","expliquer","strategie","stratégie","contenu"],how:["Ouvre le site et crée un compte gratuit si nécessaire.","Décris ton objectif avec le contexte et le résultat attendu.","Demande une réponse structurée, puis affine avec des précisions."],benefits:["Aide à clarifier une idée et organiser un projet.","Produit des brouillons et des plans rapidement.","Formule gratuite disponible, avec limites d'utilisation."]},
  {name:"Gemini",category:"Assistant IA",description:"Assistant IA pour rechercher des idées, comprendre et rédiger.",url:"https://gemini.google.com/",keywords:["idee","idée","recherche","texte","apprendre","expliquer","image","document","contenu"],how:["Connecte-toi avec un compte Google.","Décris précisément la tâche à accomplir.","Vérifie les informations importantes avec des sources fiables."],benefits:["Intégration avec l'écosystème Google.","Aide à comprendre, rédiger et explorer des idées.","Accès gratuit avec limites et fonctions variables."]},
  {name:"Perplexity",category:"Recherche",description:"Rechercher des informations sur le Web avec des références.",url:"https://www.perplexity.ai/",keywords:["recherche","information","source","actualite","actualité","comparaison","etude","étude","marche","marché"],how:["Saisis une question précise.","Consulte les sources affichées sous la réponse.","Ouvre les sources originales pour vérifier les faits."],benefits:["Références consultables.","Utile pour comparer et faire une première recherche.","Formule gratuite disponible."]},
  {name:"Canva",category:"Design",description:"Créer des affiches, présentations, miniatures et visuels.",url:"https://www.canva.com/",keywords:["affiche","visuel","design","flyer","miniature","presentation","présentation","logo","publication","post","image"],how:["Crée un compte gratuit.","Choisis un format ou un modèle.","Modifie textes, couleurs et éléments, puis exporte."],benefits:["Modèles prêts à personnaliser.","Formats adaptés aux réseaux sociaux.","Nombreux éléments gratuits, certains contenus sont payants."]},
  {name:"Photopea",category:"Retouche photo",description:"Retoucher des images dans un éditeur proche de Photoshop.",url:"https://www.photopea.com/",keywords:["photo","retouche","detourer","détourer","montage","image","calque","png"],how:["Ouvre Photopea dans ton navigateur.","Importe une image depuis ton appareil.","Utilise les calques et outils de retouche, puis exporte."],benefits:["Fonctionne dans le navigateur.","Prend en charge PSD et de nombreux formats.","Utilisation gratuite avec publicité."]},
  {name:"Remove.bg",category:"Détourage",description:"Supprimer automatiquement l'arrière-plan d'une photo.",url:"https://www.remove.bg/",keywords:["fond","arriere-plan","arrière-plan","detourer","détourer","transparent","photo","portrait"],how:["Téléverse une image nette.","Laisse l'outil détecter le sujet.","Télécharge le résultat selon les options gratuites disponibles."],benefits:["Très rapide pour isoler un sujet.","Aucune compétence avancée nécessaire.","Téléchargement gratuit limité en résolution/crédits."]},
  {name:"CapCut",category:"Montage vidéo",description:"Monter des vidéos verticales, ajouter du texte et des sous-titres.",url:"https://www.capcut.com/",keywords:["video","vidéo","montage","tiktok","reel","short","sous-titre","sous titre","clip"],how:["Importe tes séquences dans un nouveau projet.","Coupe les passages inutiles et ajoute texte ou sous-titres.","Exporte en format vertical pour TikTok, Reels ou Shorts."],benefits:["Interface accessible aux débutants.","Outils de montage adaptés aux réseaux sociaux.","Fonctions gratuites et options Pro payantes."]},
  {name:"Clipchamp",category:"Montage vidéo",description:"Monter des vidéos et enregistrer des contenus depuis le navigateur.",url:"https://clipchamp.com/",keywords:["video","vidéo","montage","couper","assembler","presentation","présentation","youtube"],how:["Connecte-toi et crée un projet vidéo.","Importe tes médias et organise la timeline.","Ajoute titres et transitions, puis exporte."],benefits:["Montage simple dans le navigateur.","Utile pour des vidéos explicatives.","Offre gratuite disponible avec conditions d'export." ]},
  {name:"Audacity",category:"Audio",description:"Enregistrer, nettoyer et monter des fichiers audio.",url:"https://www.audacityteam.org/",keywords:["audio","son","voix","musique","enregistrement","nettoyer","podcast"],how:["Installe Audacity sur un ordinateur.","Importe ou enregistre ton audio.","Réduis le bruit, coupe les erreurs et exporte."],benefits:["Logiciel libre et gratuit.","Outils de nettoyage et montage audio.","Pas d'abonnement nécessaire."]},
  {name:"Google Docs",category:"Documents",description:"Rédiger et partager des documents en ligne.",url:"https://docs.google.com/",keywords:["document","rapport","lettre","rediger","rédiger","texte","memoire","mémoire"],how:["Ouvre Google Docs avec ton compte Google.","Crée un document vierge ou utilise un modèle.","Rédige et partage avec les droits adaptés."],benefits:["Sauvegarde en ligne.","Collaboration en temps réel.","Utilisation gratuite avec un compte Google."]},
  {name:"Google Sheets",category:"Tableur",description:"Créer des tableaux, budgets et suivis de données.",url:"https://sheets.google.com/",keywords:["tableau","budget","calcul","liste","statistique","donnee","donnée","comptabilite","comptabilité"],how:["Crée une feuille de calcul.","Organise les données en colonnes.","Utilise formules et filtres pour les analyser."],benefits:["Formules et graphiques intégrés.","Collaboration en temps réel.","Accès gratuit avec un compte Google."]},
  {name:"Notion",category:"Organisation",description:"Organiser des notes, tâches et projets.",url:"https://www.notion.so/",keywords:["organiser","organisation","projet","tache","tâche","planning","notes","equipe","équipe"],how:["Crée un espace gratuit.","Choisis une page ou un modèle de projet.","Ajoute tâches, dates et informations utiles."],benefits:["Centralise notes et tâches.","Pages personnalisables.","Formule gratuite pour usage individuel."]},
  {name:"freeCodeCamp",category:"Formation",description:"Apprendre la programmation avec des exercices pratiques.",url:"https://www.freecodecamp.org/",keywords:["programmer","programmation","code","coder","html","css","javascript","site web","developper","développer"],how:["Crée un compte gratuit.","Choisis un parcours de formation.","Suis les leçons et valide les exercices pratiques."],benefits:["Cours et exercices gratuits.","Apprentissage progressif par la pratique.","Certifications gratuites sur les parcours proposés."]},
  {name:"Khan Academy",category:"Formation",description:"Apprendre les mathématiques, sciences et autres matières.",url:"https://fr.khanacademy.org/",keywords:["cours","etudier","étudier","math","mathematique","mathématique","science","formation","apprendre"],how:["Choisis ta matière et ton niveau.","Suis les leçons courtes.","Fais les exercices pour mesurer tes progrès."],benefits:["Ressources éducatives gratuites.","Exercices et suivi de progression.","Adapté à plusieurs niveaux."]},
  {name:"WordPress.com",category:"Création de site",description:"Créer un site ou un blog avec une formule de départ gratuite.",url:"https://wordpress.com/",keywords:["site","blog","web","page internet","vitrine","publier"],how:["Crée un compte et choisis un thème.","Ajoute tes pages et tes contenus.","Publie avec l'adresse gratuite proposée."],benefits:["Création sans programmation obligatoire.","Thèmes et éditeur de pages.","Formule gratuite avec adresse et fonctions limitées."]},
  {name:"Google Sites",category:"Création de site",description:"Créer simplement un site vitrine ou un espace de présentation.",url:"https://sites.google.com/",keywords:["site","web","page internet","vitrine","portfolio","presentation","présentation"],how:["Ouvre Google Sites avec ton compte Google.","Choisis un modèle et ajoute tes sections.","Publie le site et partage son adresse."],benefits:["Très simple à prendre en main.","Hébergement inclus dans le service.","Gratuit avec un compte Google."]}
];

const norm=(s:string)=>s.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function matchesTool(t:Tool,q:string) {
  const query=norm(q);
  const words=query.split(/[^a-z0-9]+/).filter(w=>w.length>2);
  const hay=norm([t.name,t.category,t.description,...t.keywords].join(" "));
  return t.keywords.some(k=>query.includes(norm(k))) || words.some(w=>hay.includes(w));
}

export default function App() {
  const [lang,setLang]=useState<"fr"|"en">("fr");
  const [request,setRequest]=useState("");
  const [submitted,setSubmitted]=useState("");
  const [selectedTool,setSelectedTool]=useState<Tool|null>(null);
  const [activeService,setActiveService]=useState<Service|null>(null);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [adsenseClient,setAdsenseClient]=useState("");
  const fr=lang==="fr";
  const recommendations=useMemo(()=>submitted?tools.filter(t=>matchesTool(t,submitted)).slice(0,6):[],[submitted]);
  useEffect(()=>{fetch("/api/public/campaigns").then(r=>r.ok?r.json():Promise.reject()).then(d=>setCampaigns(d.campaigns||[])).catch(()=>{});fetch("/api/public/settings").then(r=>r.ok?r.json():Promise.reject()).then(d=>setAdsenseClient(d.adsense_client||"")).catch(()=>{});},[]);
  useEffect(()=>{if(!adsenseClient||!/^ca-pub-[0-9]{16}$/.test(adsenseClient)||document.querySelector("script[data-aqui-adsense]"))return;const s=document.createElement("script");s.async=true;s.crossOrigin="anonymous";s.dataset.aquiAdsense="true";s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+adsenseClient;document.head.appendChild(s);},[adsenseClient]);
  useEffect(()=>{if(!activeService)return;const frame=requestAnimationFrame(()=>document.getElementById(activeService==="tools"?"demande-outils":"compte")?.scrollIntoView({behavior:"smooth",block:"start"}));return()=>cancelAnimationFrame(frame);},[activeService]);
  const syncRemote=useCallback((_favorites:string[],_progress:string[])=>{},[]);

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#accueil"><span className="brand-mark">A</span><span>AQUI NET <strong>HUB</strong></span></a>
      <nav className="main-nav"><a href="#accueil">{fr?"Accueil":"Home"}</a><a href="#services">{fr?"Services":"Services"}</a><a href="#services">{fr?"Espace membre":"Member area"}</a></nav>
      <button className="language-button" onClick={()=>setLang(fr?"en":"fr")}>{fr?"EN":"FR"}</button>
    </header>
    <main>
      <section className="hub-hero" id="accueil">
        <span className="eyebrow">AQUI NET HUB · DIGITAL ACTION CENTER</span>
        <h1>{fr?"Ton idée. Les bons outils. Des résultats concrets.":"Your idea. The right tools. Practical results."}</h1>
        <p>{fr?"Un seul espace pour trouver des outils gratuits, créer des vidéos, améliorer tes réseaux sociaux et proposer des partenariats.":"One place to find free tools, create videos, improve your social accounts and propose partnerships."}</p>
        <a className="primary-button" href="#services">{fr?"Commencer maintenant":"Get started"}</a>
      </section>

      <section className="hub-services section" id="services">
        <div className="section-heading"><span className="eyebrow">AQUI NET HUB · SERVICES</span><h2>{fr?"Choisis un service":"Choose a service"}</h2><p>{fr?"Appuie sur une option pour découvrir uniquement ses fonctions.":"Select a service to reveal its features."}</p></div>
        <div className="service-grid">
          <button type="button" className={"service-card service-public "+(activeService==="tools"?"selected":"")} onClick={()=>{setActiveService("tools");setSelectedTool(null);}}><span className="service-number">01</span><span className="service-symbol">✦</span><h3>{fr?"Trouver des outils":"Find tools"}</h3><span className="service-action">{fr?"Ouvrir le service":"Open service"} ↗</span></button>
          <button type="button" className={"service-card "+(activeService==="video"?"selected":"")} onClick={()=>setActiveService("video")}><span className="service-number">02</span><span className="service-symbol">▶</span><h3>{fr?"Génération vidéo IA":"AI video generation"}</h3><span className="service-action">{fr?"Ouvrir le service":"Open service"} ↗</span></button>
          <button type="button" className={"service-card "+(activeService==="social"?"selected":"")} onClick={()=>setActiveService("social")}><span className="service-number">03</span><span className="service-symbol">◎</span><h3>{fr?"Analyse des réseaux sociaux":"Social account analysis"}</h3><span className="service-action">{fr?"Ouvrir le service":"Open service"} ↗</span></button>
          <button type="button" className={"service-card "+(activeService==="partners"?"selected":"")} onClick={()=>setActiveService("partners")}><span className="service-number">04</span><span className="service-symbol">◇</span><h3>{fr?"Partenariats & publicité":"Partnerships & advertising"}</h3><span className="service-action">{fr?"Ouvrir le service":"Open service"} ↗</span></button>
        </div>
      </section>
      {campaigns.length>0&&<section className="promo-ticker" aria-label="Publicités"><div className="promo-track">{[...campaigns,...campaigns].map((campaign,i)=><a key={campaign.id+"-"+i} href={campaign.destination_url||"#services"} target={campaign.destination_url?"_blank":undefined} rel="noreferrer"><span>✦</span> {campaign.title} <small>{campaign.description}</small> <b>{fr?"En savoir plus":"Learn more"} ↗</b></a>)}</div></section>}
      {activeService==="tools"&&<section className="section request-section" id="demande-outils">
        <div className="section-heading"><span className="eyebrow">01 · SMART TOOL FINDER</span><h2>{fr?"Décris ce que tu veux accomplir":"Describe what you want to achieve"}</h2><p>{fr?"Exemple : je veux créer un logo, monter une vidéo TikTok, apprendre l'anglais ou construire un site web.":"Example: I want to create a logo, edit a TikTok video, learn English or build a website."}</p></div>
        <form className="tool-request-form" onSubmit={e=>{e.preventDefault();setSubmitted(request.trim());setSelectedTool(null);}}>
          <textarea value={request} onChange={e=>setRequest(e.target.value)} rows={3} placeholder={fr?"Décris ton objectif avec tes propres mots…":"Describe your goal in your own words…"} required />
          <button className="primary-button" type="submit" disabled={!request.trim()}>{fr?"Trouver les outils gratuits adaptés":"Find suitable free tools"} ↗</button>
        </form>
        {submitted && <div className="recommendation-results">
          <div className="recommendation-heading"><h3>{fr?"Outils correspondant à ta demande":"Tools matching your request"}</h3><button className="text-button" onClick={()=>{setSubmitted("");setSelectedTool(null);}}>{fr?"Nouvelle recherche":"New search"}</button></div>
          {recommendations.length ? <div className="recommended-grid">{recommendations.map(t=><button className="recommended-tool" key={t.name} onClick={()=>setSelectedTool(t)}><span>{t.category}</span><strong>{t.name}</strong><small>{t.description}</small><b>{fr?"Voir le guide":"View guide"} ↗</b></button>)}</div> : <p className="no-match">{fr?"Je n'ai pas identifié d'outil correspondant avec certitude. Reformule ton objectif en précisant le résultat attendu.":"I couldn't confidently match a tool. Rephrase your goal and specify the expected result."}</p>}
        </div>}
        {selectedTool && <article className="tool-detail-page">
          <button className="text-button" onClick={()=>setSelectedTool(null)}>← {fr?"Retour aux résultats":"Back to results"}</button>
          <span className="eyebrow">{selectedTool.category}</span><h3>{selectedTool.name}</h3><p>{selectedTool.description}</p>
          <div className="tool-detail-columns"><div><h4>{fr?"Comment utiliser cet outil":"How to use this tool"}</h4><ol>{selectedTool.how.map(x=><li key={x}>{x}</li>)}</ol></div><div><h4>{fr?"Avantages":"Benefits"}</h4><ul>{selectedTool.benefits.map(x=><li key={x}>{x}</li>)}</ul></div></div>
          <a className="primary-button" href={selectedTool.url} target="_blank" rel="noopener noreferrer">{fr?"Ouvrir le site officiel":"Open official website"} ↗</a>
          <small className="free-disclaimer">{fr?"Les services indiqués proposent une formule ou un usage gratuit ; des limites, crédits ou options payantes peuvent s'appliquer selon l'outil. Vérifie les conditions sur le site officiel.":"These services offer a free tier or free usage; limits, credits or paid options may apply. Check the official terms."}</small>
        </article>}
      </section>}

      {activeService && activeService!=="tools" && <AccountHub service={activeService} favorites={[]} progress={[]} lang={lang} onRemoteSync={syncRemote}/>}
      <AdminPanel/>
    </main>
    <footer className="site-footer"><a className="brand footer-brand" href="#accueil"><span className="brand-mark">A</span><span>AQUI NET <strong>HUB</strong></span></a><p>{fr?"Des outils et des opportunités pour avancer dans le numérique.":"Tools and opportunities to move forward digitally."}</p><div className="footer-links"><a href="https://tiktok.com/@el.maestro907" target="_blank" rel="noreferrer">TikTok · S’abonner</a><a href="https://www.facebook.com/profile.php?id=61582777979597" target="_blank" rel="noreferrer">Facebook · S’abonner</a></div><div className="footer-contact"><strong>{fr?"Contact, assistance et dons":"Contact, support and donations"}</strong><a href="tel:+22892244653">+228 92 24 46 53</a><a href="tel:+22898393862">+228 98 39 38 62</a><a href="https://wa.me/22892244653" target="_blank" rel="noreferrer">WhatsApp</a></div><small>© {new Date().getFullYear()} AQUI NET HUB</small></footer>
  </div>;
}
