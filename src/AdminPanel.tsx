import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

const db = createClient("https://xbobkysbtvtmepqgtnbt.supabase.co", "sb_publishable_AGtfBQyqyKbH5C_4f5cQgw_bm0MmusA");
type RequestItem = {
  id: string; user_id: string; contact_name: string; email: string; phone: string | null;
  website: string | null; status: "received" | "reviewing" | "accepted" | "declined";
  created_at: string; company_name?: string; budget?: string | null; message?: string;
  organization?: string; proposal?: string;
};
type Data = { ads: RequestItem[]; partners: RequestItem[] };
const labels: Record<RequestItem["status"], string> = {
  received: "Reçue", reviewing: "En cours", accepted: "Acceptée", declined: "Refusée",
};
export default function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data>({ ads: [], partners: [] });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/requests", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json() as Data & { error?: string };
      if (!response.ok) throw new Error(result.error || "Accès administrateur indisponible.");
      setData(result);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erreur de chargement.");
    } finally { setBusy(false); }
  }, [session?.access_token]);
  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) void load(); }, [session?.user.id, load]);
  async function update(kind: "ads" | "partners", id: string, status: RequestItem["status"]) {
    if (!session) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/requests/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Modification refusée.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erreur de mise à jour.");
      setBusy(false);
    }
  }
  function group(kind: "ads" | "partners", items: RequestItem[]) {
    return <div className="account-card">
      <h3>{kind === "ads" ? "AQUI NET ADS" : "AQUI NET PARTNERS"} · {items.length}</h3>
      {items.length === 0 && <p>Aucune demande pour le moment.</p>}
      {items.map(item => <article className="admin-request-row" key={item.id}>
        <div>
          <strong>{kind === "ads" ? item.company_name : item.organization}</strong>
          <p>{item.contact_name} · {item.email}{item.phone ? ` · ${item.phone}` : ""}</p>
          {item.website && <p><a href={item.website} target="_blank" rel="noreferrer">{item.website}</a></p>}
          <p>{kind === "ads" ? item.message : item.proposal}</p>
          {kind === "ads" && item.budget && <p>Budget indicatif : {item.budget} FCFA</p>}
          <small>{new Date(item.created_at).toLocaleString("fr-FR")} · {labels[item.status]}</small>
        </div>
        <div className="admin-actions">
          <button type="button" disabled={busy} onClick={() => void update(kind, item.id, "reviewing")}>En cours</button>
          <button type="button" disabled={busy} onClick={() => void update(kind, item.id, "accepted")}>Accepter</button>
          <button type="button" disabled={busy} onClick={() => void update(kind, item.id, "declined")}>Refuser</button>
          <button type="button" disabled={busy} onClick={() => void update(kind, item.id, "received")}>Réinitialiser</button>
        </div>
      </article>)}
    </div>;
  }
  return <section className="section account-hub" id="administration">
    <div className="section-heading"><div><span className="eyebrow">AQUI NET · ADMIN</span><h2>Administration</h2><p>Gestion confidentielle des demandes publicitaires et partenariats.</p></div></div>
    {!session ? <div className="account-card"><p>Connecte-toi avec le compte administrateur autorisé.</p><a className="primary-button" href="#compte">Aller à la connexion</a></div> : <>
      <div className="account-card account-summary-heading"><p>Connecté : <strong>{session.user.email}</strong></p><button type="button" className="filter-button" disabled={busy} onClick={() => void load()}>{busy ? "…" : "Actualiser"}</button></div>
      {notice && <p className="account-message" role="status">{notice}</p>}
      {group("ads", data.ads)}
      {group("partners", data.partners)}
    </>}
  </section>;
}
