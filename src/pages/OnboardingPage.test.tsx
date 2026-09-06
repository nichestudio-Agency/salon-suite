import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OnboardingPage } from "./OnboardingPage";
import * as onboarding from "../firebase/onboarding";

beforeEach(() => vi.restoreAllMocks());

function setup() {
  return render(
    <MemoryRouter initialEntries={["/registrati-salone"]}>
      <Routes>
        <Route path="/registrati-salone" element={<OnboardingPage />} />
        <Route path="/dashboard/servizi" element={<div>dashboard servizi</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingPage", () => {
  it("invia i dati a registerOwner e naviga alla dashboard", async () => {
    const spy = vi
      .spyOn(onboarding, "registerOwner")
      .mockResolvedValue({ salonId: "s1" });
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "t@ex.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Nome del salone"), "Barberia X");
    await userEvent.click(screen.getByRole("button", { name: /crea il salone/i }));

    await waitFor(() =>
      expect(screen.getByText("dashboard servizi")).toBeInTheDocument()
    );
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatchObject({
      email: "t@ex.com",
      password: "password123",
      nomeSalone: "Barberia X",
      tipo: "barberia",
    });
  });

  it("mostra un errore se registerOwner fallisce", async () => {
    vi.spyOn(onboarding, "registerOwner").mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "t@ex.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Nome del salone"), "Barberia X");
    await userEvent.click(screen.getByRole("button", { name: /crea il salone/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
