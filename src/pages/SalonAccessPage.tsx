import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import {
  normalizeSalonAccessCode,
  parseSalonAccessCode,
} from "../domain/salon-access";
import { resolveSalonAccessCode } from "../firebase/salon-repo";
import "./salon-access.css";

type BarcodeDetectorInstance = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorConstructor = new (options: {
  formats: string[];
}) => BarcodeDetectorInstance;

export function SalonAccessPage() {
  const { code: routeCode = "" } = useParams();
  const navigate = useNavigate();
  const { salon, selectSalon } = useSalonTenant();
  const [code, setCode] = useState(() => normalizeSalonAccessCode(routeCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopScanner() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function enter(rawCode: string) {
    const normalized = parseSalonAccessCode(rawCode);
    if (normalized.length < 6) {
      setError("Inserisci il codice completo del salone.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resolved = await resolveSalonAccessCode(normalized);
      if (!resolved) {
        setError("Codice non riconosciuto. Controllalo con il salone.");
        return;
      }
      selectSalon(resolved);
      stopScanner();
      navigate("/accedi", { replace: true });
    } catch {
      setError("Non riusciamo a verificare il codice. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (routeCode) void enter(routeCode);
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // Il deep link deve essere risolto una sola volta all'apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCode]);

  async function startScanner() {
    setError(null);
    const Detector = (
      window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "La scansione non è supportata da questo browser. Puoi inserire il codice qui sopra.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async function scan() {
        const video = videoRef.current;
        if (!streamRef.current || !video) return;
        if (video.srcObject !== stream) {
          video.srcObject = stream;
          await video.play();
        }
        try {
          const results = await new Detector({ formats: ["qr_code"] }).detect(
            video,
          );
          if (results[0]?.rawValue) {
            await enter(results[0].rawValue);
            return;
          }
        } catch {
          /* Il frame può non essere ancora pronto. */
        }
        if (streamRef.current) requestAnimationFrame(scan);
      });
    } catch {
      setError(
        "Fotocamera non disponibile. Verifica il permesso oppure usa il codice manuale.",
      );
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void enter(code);
  }

  return (
    <main className="salon-gate">
      <section className="salon-gate__visual" aria-hidden="true">
        <div className="salon-gate__mark">
          <AppIcon name="scissors" size={28} />
        </div>
        <div>
          <span>UN’APP, IL TUO SALONE</span>
          <strong>Il tuo prossimo appuntamento inizia qui.</strong>
        </div>
      </section>
      <section className="salon-gate__panel">
        <header>
          <span className="salon-gate__brand">
            <i>
              <AppIcon name="scissors" size={19} />
            </i>{" "}
            SALON SUITE
          </span>
          <small>ACCESSO CLIENTI · 01</small>
        </header>
        <div className="salon-gate__copy">
          <span>Benvenuto</span>
          <h1>Entra nel tuo salone.</h1>
          <p>
            Inserisci il codice che hai ricevuto oppure inquadra il QR. Vedrai
            esclusivamente servizi, team e vantaggi del tuo salone.
          </p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="salon-code">Codice salone</label>
          <div className="salon-gate__code">
            <input
              id="salon-code"
              value={code}
              onChange={(event) =>
                setCode(normalizeSalonAccessCode(event.target.value))
              }
              placeholder="ES. STUDIO7K4P"
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="go"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? (
                "Verifica…"
              ) : (
                <>
                  <span>Continua</span>
                  <AppIcon name="arrow" size={19} />
                </>
              )}
            </button>
          </div>
        </form>
        <div className="salon-gate__divider">
          <span>oppure</span>
        </div>
        {!scanning ? (
          <button
            className="salon-gate__scan"
            type="button"
            onClick={() => void startScanner()}
          >
            <AppIcon name="scan" />
            <span>
              <strong>Scansiona il QR</strong>
              <small>Apri la fotocamera</small>
            </span>
            <AppIcon name="arrow" size={18} />
          </button>
        ) : (
          <div className="salon-gate__camera">
            <video ref={videoRef} muted playsInline />
            <div>
              <span>Inquadra il QR del salone</span>
              <button type="button" onClick={stopScanner}>
                Chiudi
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="salon-gate__error" role="alert">
            {error}
          </p>
        )}
        {salon && !routeCode && (
          <p className="salon-gate__known">
            Ultimo salone: <strong>{salon.nome}</strong> ·{" "}
            <Link to="/accedi">Accedi</Link>
          </p>
        )}
        <footer>
          Il codice serve solo a trovare il salone. Il tuo account e i tuoi dati
          restano protetti.
        </footer>
      </section>
    </main>
  );
}
