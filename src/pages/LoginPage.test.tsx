import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import * as authApi from "../firebase/auth";

describe("LoginPage", () => {
  it("porta il Super Admin direttamente nella propria dashboard", async () => {
    vi.spyOn(authApi, "signIn").mockResolvedValue({ uid: "admin", ruolo: "superadmin" });
    render(<MemoryRouter initialEntries={["/accedi"]}><Routes>
      <Route path="/accedi" element={<LoginPage />} />
      <Route path="/admin" element={<div>dashboard piattaforma</div>} />
    </Routes></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("Email"), "admin@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Accedi" }));
    expect(await screen.findByText("dashboard piattaforma")).toBeInTheDocument();
  });

  it("segnala un profilo non configurato senza lasciare una sessione aperta", async () => {
    vi.spyOn(authApi, "signIn").mockResolvedValue({ uid: "orphan-account" });
    const signOutSpy = vi.spyOn(authApi, "signOutUser").mockResolvedValue();

    render(<MemoryRouter initialEntries={["/accedi"]}><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("Email"), "orphan@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByText(/profilo dell'account non è configurato/i)).toBeInTheDocument();
    expect(signOutSpy).toHaveBeenCalledOnce();
  });
});
