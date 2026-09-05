import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformDashboardPage } from "./PlatformDashboardPage";
import * as platformApi from "../firebase/platform-admin";

const salons: platformApi.PlatformSalon[] = [
  { id: "s1", nome: "Officina 27", dominio: "officina27.barberia.app", timezone: "Europe/Rome", owner: { nome: "Riccardo Serra", email: "riccardo@example.test" }, clienti: 18, operatori: 2, prenotazioni30g: 11, fatturato30g: 28600, licenza: { stato: "attiva", piano: "pro", scadenza: "2027-01-20", prezzoMensile: 12900 } },
  { id: "s2", nome: "Bottega 1932", dominio: "bottega.barberia.app", timezone: "Europe/Rome", owner: null, clienti: 7, operatori: 1, prenotazioni30g: 4, fatturato30g: 9200, licenza: { stato: "sospesa", piano: "studio", scadenza: "2026-08-20", prezzoMensile: 7900 } },
];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(platformApi, "listPlatformSalons").mockResolvedValue(salons);
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
    await userEvent.click(screen.getByRole("button", { name: "Gestisci" }));
    await userEvent.selectOptions(screen.getByLabelText("Stato"), "sospesa");
    await userEvent.click(screen.getByRole("button", { name: "Salva licenza" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ salonId: "s1", stato: "sospesa", piano: "pro", prezzoMensile: 12900 })));
  });
});
