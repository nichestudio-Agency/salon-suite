import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformDashboardPage } from "./PlatformDashboardPage";
import * as platformApi from "../firebase/platform-admin";

const salons: platformApi.PlatformSalon[] = [
  { id: "s1", nome: "Officina 27", tipo: "barberia", branding: null, dominio: "officina27.barberia.app", timezone: "Europe/Rome", owner: { nome: "Riccardo Serra", email: "riccardo@example.test" }, clienti: 18, operatori: 2, prenotazioni30g: 11, fatturato30g: 28600, licenza: { stato: "attiva", piano: "pro", scadenza: "2027-01-20", prezzoMensile: 12900 } },
  { id: "s2", nome: "Bottega 1932", tipo: "barberia", branding: null, dominio: "bottega.barberia.app", timezone: "Europe/Rome", owner: null, clienti: 7, operatori: 1, prenotazioni30g: 4, fatturato30g: 9200, licenza: { stato: "sospesa", piano: "studio", scadenza: "2026-08-20", prezzoMensile: 7900, ciclo: "mensile", statoPagamento: "insoluto", rinnovoAutomatico: false } },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(platformApi, "listPlatformSalons").mockResolvedValue(salons);
  vi.spyOn(platformApi, "getSubscriptionPlansConfig").mockResolvedValue(platformApi.DEFAULT_SUBSCRIPTION_PLANS);
});

describe("PlatformDashboardPage", () => {
  it("mostra metriche globali e saloni", async () => {
    render(<PlatformDashboardPage />);
    expect(await screen.findByText("Officina 27")).toBeInTheDocument();
    expect(screen.getByText("Bottega 1932")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("filtra e aggiorna una licenza", async () => {
    const update = vi.spyOn(platformApi, "updatePlatformSalonLicense").mockResolvedValue();
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.type(screen.getByLabelText("Cerca salone"), "Officina");
    expect(screen.queryByText("Bottega 1932")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Configura" }));
    await userEvent.selectOptions(screen.getByLabelText("Stato"), "sospesa");
    await userEvent.click(screen.getByRole("button", { name: "Salva licenza" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ salonId: "s1", stato: "sospesa", piano: "pro", prezzoMensile: 12900 })));
  });

  it("porta subito alle posizioni di pagamento da verificare", async () => {
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.click(screen.getByRole("button", { name: /posizioni da verificare/i }));
    expect(screen.getByText("Bottega 1932")).toBeInTheDocument();
    expect(screen.queryByText("Officina 27")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Posizioni da verificare/ })).toBeInTheDocument();
  });

  it("registra una nuova attività con titolare e abbonamento", async () => {
    const create = vi.spyOn(platformApi, "createPlatformSalon").mockResolvedValue("studio-forma");
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.click(screen.getByRole("button", { name: /Nuova attività/ }));
    await userEvent.type(screen.getByLabelText("Nome attività"), "Studio Forma");
    await userEvent.type(screen.getByLabelText("Nome e cognome"), "Elisa Neri");
    await userEvent.type(screen.getByLabelText("Email di accesso"), "elisa@studioforma.test");
    await userEvent.type(screen.getByLabelText("Password iniziale"), "Password26!");
    await userEvent.click(screen.getByRole("button", { name: "Crea attività e accesso" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      salonId: "studio-forma", tipo: "barberia", piano: "studio", ownerEmail: "elisa@studioforma.test",
    })));
  });

  it("personalizza la palette del tenant", async () => {
    const updateBrand = vi.spyOn(platformApi, "updatePlatformSalonBranding").mockResolvedValue();
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.type(screen.getByLabelText("Cerca salone"), "Officina");
    await userEvent.click(screen.getByRole("button", { name: "Configura" }));
    fireEvent.change(screen.getByLabelText("Accento"), { target: { value: "#b45a3c" } });
    await userEvent.click(screen.getByRole("button", { name: "Pubblica identità" }));
    await waitFor(() => expect(updateBrand).toHaveBeenCalledWith(expect.objectContaining({ salonId: "s1", accentColor: "#b45a3c" })));
  });

  it("modifica nomi, prezzi e dotazioni del catalogo", async () => {
    const updatePlans = vi.spyOn(platformApi, "updateSubscriptionPlansConfig").mockResolvedValue();
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.click(screen.getByRole("button", { name: "Configura piani" }));
    const names = screen.getAllByLabelText("Nome piano");
    await userEvent.clear(names[0]);
    await userEvent.type(names[0], "Essenziale");
    await userEvent.click(screen.getByRole("button", { name: "Salva catalogo" }));
    await waitFor(() => expect(updatePlans).toHaveBeenCalledWith(expect.objectContaining({
      piani: expect.objectContaining({ start: expect.objectContaining({ nome: "Essenziale", prezzoMensile: 4900 }) }),
    })));
  });

  it("assegna eccezioni e prove temporanee alla singola attività", async () => {
    const update = vi.spyOn(platformApi, "updatePlatformSalonLicense").mockResolvedValue();
    render(<PlatformDashboardPage />);
    await screen.findByText("Officina 27");
    await userEvent.type(screen.getByLabelText("Cerca salone"), "Officina");
    await userEvent.click(screen.getByRole("button", { name: "Configura" }));
    await userEvent.selectOptions(screen.getByLabelText("Accesso Fidelity"), "disabled");
    fireEvent.change(screen.getByLabelText("Prova Importazione dati"), { target: { value: "2027-03-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Salva licenza" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({
      funzionalitaPersonalizzate: expect.objectContaining({ fidelity: false }),
      funzionalitaTemporanee: expect.arrayContaining([{ funzione: "importazione", scadeIl: "2027-03-15" }]),
    })));
  });
});
