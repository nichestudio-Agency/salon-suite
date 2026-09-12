import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorsPage } from "./OperatorsPage";
import * as repo from "../firebase/operator-repo";
import * as authCtx from "../app/auth-context";
import * as salesRepo from "../firebase/sales-repo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false,
    user: {} as never,
    role: "owner",
    salonId: "s1",
  });
  vi.spyOn(salesRepo, "listOperatorStats").mockResolvedValue([]);
});

describe("OperatorsPage", () => {
  it("elenca gli operatori", async () => {
    vi.spyOn(repo, "listOperators").mockResolvedValue([
      { id: "o1", nome: "Marco", attivo: true },
    ]);

    render(<OperatorsPage />);

    expect(await screen.findByText("Marco")).toBeInTheDocument();
  });

  it("aggiunge un operatore", async () => {
    vi.spyOn(repo, "listOperators").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createOperator").mockResolvedValue("o2");

    render(<OperatorsPage />);
    await userEvent.type(screen.getByLabelText("Nome operatore"), "Luca");
    await userEvent.click(
      screen.getByRole("button", { name: /aggiungi operatore/i }),
    );

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ nome: "Luca", attivo: true }),
      ),
    );
  });

  it("programma un periodo di indisponibilità", async () => {
    vi.spyOn(repo, "listOperators")
      .mockResolvedValue([{ id: "o1", nome: "Marco", attivo: true }]);
    const update = vi.spyOn(repo, "updateOperator").mockResolvedValue();

    render(<OperatorsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Rendi indisponibile" }));
    fireEvent.change(screen.getByLabelText("Dal"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Al"), { target: { value: "2026-09-12" } });
    await userEvent.type(screen.getByLabelText("Motivo (opzionale)"), "Ferie");
    await userEvent.click(screen.getByRole("button", { name: "Programma periodo" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("s1", "o1", {
      indisponibilita: [expect.objectContaining({ dal: "2026-09-10", al: "2026-09-12", motivo: "Ferie" })],
    }));
  });
});
