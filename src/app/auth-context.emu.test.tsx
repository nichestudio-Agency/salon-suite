import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "../firebase/app";
import { registerOwner } from "../firebase/onboarding";
import { AuthProvider, useAuth } from "./auth-context";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

function Probe() {
  const { loading, role, salonId } = useAuth();
  if (loading) return <div>caricamento</div>;
  return <div>ruolo:{role ?? "nessuno"} salone:{salonId ?? "nessuno"}</div>;
}

describe("AuthProvider", () => {
  it("espone ruolo owner e salonId dopo l'onboarding", async () => {
    const email = `t_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "X",
      timezone: "Europe/Rome", orariApertura: {},
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText(`ruolo:owner salone:${salonId}`)).toBeInTheDocument()
    );
  });
});
