import { useCallback, useEffect, useState, type FormEvent } from "react";

type Campaign = {
  id: string;
  title: string;
  description: string;
  destination_url: string | null;
  image_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  trial_started_at: string | null;
  created_at: string;
};
type Trial = { started_at: string; ends_at: string };
type Props = { accessToken: string; lang: "fr" | "en" };

export default function AdvertiserHub({ accessToken, lang }: Props) {
  const fr = lang === "fr";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", destination_url: "", image_url: "" });
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/ads/campaigns", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    const data = await response.json() as {
      campaigns?: Campaign[]; trial?: Trial | null; subscription_active?: boolean; error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Campaign list unavailable.");
    setCampaigns(data.campaigns || []);
    setTrial(data.trial || null);
    setSubscriptionActive(!!data.subscription_active);
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    refresh().catch(error => {
      if (active) setNotice(error instanceof Error ? error.message : "Campaign list unavailable.");
    });
    return () => { active = false; };
  }, [refresh]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!acceptedRules) {
      setNotice(fr ? "Confirme que tu disposes des droits sur la publicité et ses médias." : "Confirm that you have rights to the advertisement and its media.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify(draft),
      });
      const data = await response.json() as { error?: string; code?: string };
      if (!response.ok) throw new Error(data.error || "Campaign creation failed.");
      setDraft({ title: "", description: "", destination_url: "", image_url: "" });
      setAcceptedRules(false);
      setNotice(fr ? "Campagne publiée. La période de diffusion est affichée ci-dessous." : "Campaign published. Its display period is shown below.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setCampaignActive(campaign: Campaign, is_active: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ads/campaigns/" + campaign.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ is_active }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Campaign update failed.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCampaign(campaign: Campaign) {
    if (!window.confirm(fr ? "Supprimer définitivement cette campagne ?" : "Permanently delete this campaign?")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/ads/campaigns/" + campaign.id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + accessToken },
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Campaign deletion failed.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign deletion failed.");
    } finally {
      setBusy(false);
    }
  }

  const date = (value: string | null) => value ? new Date(value).toLocaleString(fr ? "fr-FR" : "en-GB", {
    dateStyle: "medium", timeStyle: "short",
  }) : (fr ? "Non défini" : "Not set");

  return <div className="account-card advertiser-hub">
    <span className="eyebrow">AQUI NET ADS · SELF-SERVICE</span>
    <h3>{fr ? "Publie ta publicité toi-même" : "Publish your advertisement yourself"}</h3>
    <p>{fr
      ? "Une première période d'essai de 3 jours est offerte une seule fois par compte. Aucun paiement automatique : la campagne s'arrête à la fin de l'essai si tu ne souscris pas."
      : "A first 3-day trial is offered once per account. No automatic charge: the campaign stops when the trial ends unless you subscribe."}</p>
    <p className="account-footnote">{subscriptionActive
      ? (fr ? "Abonnement actif : tes nouvelles campagnes suivent la date de fin de ton abonnement." : "Active subscription: new campaigns run until your subscription end date.")
      : trial
        ? (new Date(trial.ends_at).getTime() <= Date.now()
          ? (fr ? "Essai terminé. Un abonnement est nécessaire pour publier ou réactiver une campagne." : "Trial ended. A subscription is required to publish or reactivate a campaign.")
          : (fr ? "Essai en cours jusqu'au " + date(trial.ends_at) : "Trial active until " + date(trial.ends_at)))
        : (fr ? "Ton essai de 3 jours commencera à la publication de ta première campagne." : "Your 3-day trial starts when you publish your first campaign.")}</p>

    <form className="admin-campaign-form" onSubmit={createCampaign}>
      <input value={draft.title} onChange={e => setDraft(s => ({ ...s, title: e.target.value }))} minLength={4} maxLength={80} placeholder={fr ? "Titre de la publicité" : "Advertisement title"} required />
      <textarea value={draft.description} onChange={e => setDraft(s => ({ ...s, description: e.target.value }))} minLength={10} maxLength={500} placeholder={fr ? "Description (10 à 500 caractères)" : "Description (10–500 characters)"} required />
      <input type="url" value={draft.destination_url} onChange={e => setDraft(s => ({ ...s, destination_url: e.target.value }))} placeholder={fr ? "Lien HTTPS de destination" : "HTTPS destination link"} required />
      <input type="url" value={draft.image_url} onChange={e => setDraft(s => ({ ...s, image_url: e.target.value }))} placeholder={fr ? "Lien HTTPS de l'image (facultatif)" : "HTTPS image URL (optional)"} />
      <label className="account-footnote"><input type="checkbox" checked={acceptedRules} onChange={e => setAcceptedRules(e.target.checked)} required /> {fr
        ? "Je possède les droits sur ce contenu et confirme qu'il respecte la loi et les règles de la plateforme."
        : "I own the rights to this content and confirm it complies with the law and platform rules."}</label>
      <button className="primary-button" type="submit" disabled={busy || !acceptedRules}>{busy ? "…" : fr ? "Publier ma campagne" : "Publish my campaign"}</button>
    </form>

    {notice && <p className="account-message" role="status">{notice}</p>}
    <div className="account-summary-heading">
      <div><h4>{fr ? "Mes campagnes" : "My campaigns"} · {campaigns.length}</h4></div>
      <button type="button" className="filter-button" disabled={busy} onClick={() => { setNotice(""); void refresh().catch(e => setNotice(e instanceof Error ? e.message : "Refresh failed.")); }}>{fr ? "Actualiser" : "Refresh"}</button>
    </div>
    {!campaigns.length && <p className="account-footnote">{fr ? "Aucune campagne pour le moment." : "No campaigns yet."}</p>}
    {campaigns.map(campaign => {
      const expired = !!campaign.ends_at && new Date(campaign.ends_at).getTime() <= Date.now();
      const status = !campaign.is_active ? (fr ? "En pause" : "Paused") : expired ? (fr ? "Essai / diffusion terminé" : "Trial / display ended") : (fr ? "En ligne" : "Live");
      return <article className="subscription-row" key={campaign.id}>
        <div>
          <strong>{campaign.title}</strong>
          <p>{campaign.description}</p>
          <small>{fr ? "Fin de diffusion : " : "Display ends: "}{date(campaign.ends_at)}</small>
          {campaign.destination_url && <p><a href={campaign.destination_url} target="_blank" rel="noreferrer">{fr ? "Voir la destination" : "Open destination"} ↗</a></p>}
        </div>
        <div className="account-actions">
          <span className={campaign.is_active && !expired ? "account-status active" : "account-status"}>{status}</span>
          <button type="button" className="filter-button" disabled={busy} onClick={() => void setCampaignActive(campaign, !campaign.is_active)}>{campaign.is_active ? (fr ? "Mettre en pause" : "Pause") : (fr ? "Réactiver" : "Reactivate")}</button>
          <button type="button" className="text-button" disabled={busy} onClick={() => void removeCampaign(campaign)}>{fr ? "Supprimer" : "Delete"}</button>
        </div>
      </article>;
    })}
  </div>;
}
