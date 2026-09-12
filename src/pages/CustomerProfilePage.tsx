import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import type { Gender, UserProfile } from "../domain/models";
import { signOutUser } from "../firebase/auth";
import { getUserProfile, updateUserProfile } from "../firebase/profile-repo";
import "./customer.css";

const EMPTY_PROFILE: Pick<UserProfile, "nome" | "email" | "sesso" | "dataNascita"> = {
  nome: "", email: "", sesso: "altro", dataNascita: "",
};

export function CustomerProfilePage() {
  const { user } = useAuth();
  const { salon, clearSalonSelection } = useSalonTenant();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void getUserProfile(user.uid)
      .then((data) => { if (data) setProfile(data); else setError("Profilo non disponibile."); })
      .catch(() => setError("Non è stato possibile caricare il profilo."))
      .finally(() => setLoading(false));
  }, [user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !profile.nome.trim()) return;
    setSaving(true); setNotice(null); setError(null);
    try {
      await updateUserProfile(user.uid, { nome: profile.nome, sesso: profile.sesso, dataNascita: profile.dataNascita });
      setNotice("Profilo aggiornato.");
    } catch { setError("Non è stato possibile salvare le modifiche."); }
    finally { setSaving(false); }
  }

  async function logout() {
    await signOutUser();
    clearSalonSelection();
    navigate("/", { replace: true });
  }

  if (loading) return <section className="customer-page profile-page"><div className="customer-empty">Caricamento profilo…</div></section>;

  return (
    <section className="customer-page profile-page">
      <header className="profile-hero">
        <div className="profile-avatar">{(profile.nome || "C").slice(0, 1).toUpperCase()}</div>
        <div><span className="customer-shell__eyebrow">Il tuo account</span><h1>{profile.nome || "Cliente"}</h1><p>{salon?.nome}</p></div>
      </header>

      <div className="profile-shortcuts" aria-label="Collegamenti del profilo">
        <Link to="/fidelity"><AppIcon name="card" /><span><strong>Fidelity card</strong><small>Punti, QR code e premi</small></span><AppIcon name="arrow" size={17} /></Link>
        <Link to="/i-miei-ordini"><AppIcon name="orders" /><span><strong>I miei ordini</strong><small>Stato e storico acquisti</small></span><AppIcon name="arrow" size={17} /></Link>
        <Link to="/assistenza"><AppIcon name="ticket" /><span><strong>Assistenza</strong><small>Apri un ticket con il salone</small></span><AppIcon name="arrow" size={17} /></Link>
      </div>

      <form className="profile-form" onSubmit={save}>
        <header><span>Informazioni personali</span><h2>I tuoi dati</h2><p>Questi dati aiutano il salone a riconoscerti e personalizzare l’esperienza.</p></header>
        <label>Nome e cognome<input value={profile.nome} onChange={(event) => setProfile((current) => ({ ...current, nome: event.target.value }))} required /></label>
        <label>Email<input type="email" value={profile.email} readOnly /><small>Per modificare l’email contatta il salone.</small></label>
        <div className="profile-form__row">
          <label>Data di nascita<input type="date" value={profile.dataNascita} onChange={(event) => setProfile((current) => ({ ...current, dataNascita: event.target.value }))} /></label>
          <label>Profilo<select value={profile.sesso} onChange={(event) => setProfile((current) => ({ ...current, sesso: event.target.value as Gender }))}><option value="femminile">Femminile</option><option value="maschile">Maschile</option><option value="altro">Preferisco non indicarlo</option></select></label>
        </div>
        {(notice || error) && <p className={error ? "customer-error" : "profile-notice"} role={error ? "alert" : "status"}>{error ?? notice}</p>}
        <button className="customer-button" type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Salva modifiche"}</button>
      </form>

      <button className="profile-logout" type="button" onClick={() => void logout()}><AppIcon name="logout" size={19} /> Esci e cambia salone</button>
    </section>
  );
}
