import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrdersPage } from "./OrdersPage";
import * as repo from "../firebase/order-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("OrdersPage", () => {
  it("elenca gli ordini e marca 'pronto'", async () => {
    vi.spyOn(repo, "listSalonOrders").mockResolvedValue([
      { id: "o1", clientId: "c", clientNome: "Mario", items: [{ productId: "p1", titolo: "Cera", prezzo: 1500, qta: 2 }], totale: 3000, stato: "in_attesa" },
    ]);
    const upd = vi.spyOn(repo, "updateOrderStatus").mockResolvedValue();
    render(<OrdersPage />);
    expect(await screen.findByText(/Mario/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /pronto/i }));
    await waitFor(() => expect(upd).toHaveBeenCalledWith("s1", "o1", "pronto"));
  });
});
