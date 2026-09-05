import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireSuperAdmin } from "./RequireSuperAdmin";
import * as authCtx from "./auth-context";

function renderAt(role: ReturnType<typeof authCtx.useAuth>["role"]) {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({ loading: false, user: {} as never, role, salonId: null });
  render(<MemoryRouter initialEntries={["/admin"]}><Routes>
    <Route path="/accedi" element={<div>pagina accesso</div>} />
    <Route path="/admin" element={<RequireSuperAdmin><div>controllo piattaforma</div></RequireSuperAdmin>} />
  </Routes></MemoryRouter>);
}

describe("RequireSuperAdmin", () => {
  it("consente l'accesso solo al super admin", () => {
    renderAt("superadmin");
    expect(screen.getByText("controllo piattaforma")).toBeInTheDocument();
  });

  it("isola l'area dagli owner dei saloni", () => {
    renderAt("owner");
    expect(screen.getByText("pagina accesso")).toBeInTheDocument();
  });
});
