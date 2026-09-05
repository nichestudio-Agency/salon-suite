import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsPage } from "./NotificationsPage";
import * as repo from "../firebase/coupon-repo";
import * as authCtx from "../app/auth-context";
import * as campaignApi from "../firebase/campaign";
import * as salonRepo from "../firebase/salon-repo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
  vi.spyOn(salonRepo, "getSalon").mockResolvedValue(null);
  vi.spyOn(repo, "getCouponAnalytics").mockResolvedValue([]);
});

describe("NotificationsPage — coupon", () => {
  it("elenca i coupon esistenti", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([
      { id: "a", codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true },
    ]);
    render(<NotificationsPage />);
    expect(await screen.findByText("ESTATE20", { selector: ".coupon-code" })).toBeInTheDocument();
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  it("crea un coupon percentuale", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createCoupon").mockResolvedValue("newid");
    render(<NotificationsPage />);
    await userEvent.type(screen.getByLabelText("Codice"), "AUTUNNO10");
    await userEvent.type(screen.getByLabelText("Valore"), "10");
    await userEvent.click(screen.getByRole("button", { name: /crea coupon/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ codice: "AUTUNNO10", tipo: "percentuale", valore: 10, attivo: true })
      )
    );
  });

  it("invia una campagna con i filtri scelti e mostra i destinatari", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
    const send = vi.spyOn(campaignApi, "sendCampaign").mockResolvedValue({ campaignId: "x", recipientCount: 7 });
    render(<NotificationsPage />);
    await userEvent.type(screen.getByLabelText("Titolo campagna"), "Promo estate");
    await userEvent.type(screen.getByLabelText("Testo campagna"), "Sconti su tutto");
    await userEvent.selectOptions(screen.getByLabelText("Sesso destinatari"), "maschile");
    await userEvent.type(screen.getByLabelText("Giorni senza prenotazioni"), "90");
    await userEvent.click(screen.getByRole("button", { name: /invia campagna/i }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          salonId: "s1",
          titolo: "Promo estate",
          testo: "Sconti su tutto",
          filtri: expect.objectContaining({ sesso: "maschile", bookingInactiveDays: 90 }),
        })
      )
    );
    expect(await screen.findByText(/7 destinatari/i)).toBeInTheDocument();
  });

  it("salva la configurazione compleanno", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
    vi.spyOn(salonRepo, "getSalon").mockResolvedValue({
      nome: "S", timezone: "Europe/Rome", orariApertura: {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
    });
    const save = vi.spyOn(salonRepo, "updateBirthdayConfig").mockResolvedValue();
    render(<NotificationsPage />);
    await userEvent.click(await screen.findByLabelText("Auguri di compleanno attivi"));
    await userEvent.type(screen.getByLabelText("Messaggio di compleanno"), "Tanti auguri!");
    await userEvent.click(screen.getByRole("button", { name: /salva compleanno/i }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ attivo: true, messaggio: "Tanti auguri!" })
      )
    );
  });
});
