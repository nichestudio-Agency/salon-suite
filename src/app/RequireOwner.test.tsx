import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOwner } from "./RequireOwner";
import * as authCtx from "./auth-context";

function renderAt(state: Partial<ReturnType<typeof authCtx.useAuth>>) {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: null, role: null, salonId: null, ...state,
  } as ReturnType<typeof authCtx.useAuth>);
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/accedi" element={<div>pagina accesso</div>} />
        <Route
          path="/dashboard"
          element={
            <RequireOwner>
              <div>contenuto dashboard</div>
            </RequireOwner>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireOwner", () => {
  it("mostra il contenuto a un owner", () => {
    renderAt({ role: "owner", salonId: "s1", user: {} as never });
    expect(screen.getByText("contenuto dashboard")).toBeInTheDocument();
  });
  it("reindirizza un non-owner all'accesso", () => {
    renderAt({ role: null, user: null });
    expect(screen.getByText("pagina accesso")).toBeInTheDocument();
  });
  it("mostra un caricamento finché l'auth non è pronta", () => {
    renderAt({ loading: true });
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
});
