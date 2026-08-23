import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsPage } from "./NotificationsPage";
import * as repo from "../firebase/coupon-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("NotificationsPage — coupon", () => {
  it("elenca i coupon esistenti", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([
      { id: "a", codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true },
    ]);
    render(<NotificationsPage />);
    expect(await screen.findByText("ESTATE20")).toBeInTheDocument();
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
});
