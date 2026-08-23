import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoursPage } from "./HoursPage";
import * as repo from "../firebase/salon-repo";
import * as authCtx from "../app/auth-context";
import type { Salon } from "../domain/models";

const salon: Salon = {
  nome: "X",
  timezone: "Europe/Rome",
  orariApertura: { lun: [{ start: 540, end: 1140 }] },
  impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false,
    user: {} as never,
    role: "owner",
    salonId: "s1",
  });
});

describe("HoursPage", () => {
  it("carica gli orari del salone e li salva", async () => {
    vi.spyOn(repo, "getSalon").mockResolvedValue(salon);
    const save = vi.spyOn(repo, "updateOpeningHours").mockResolvedValue();

    render(<HoursPage />);

    expect(await screen.findByDisplayValue("09:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /salva orari/i }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ lun: [{ start: 540, end: 1140 }] }),
      ),
    );
  });
});
