import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorsPage } from "./OperatorsPage";
import * as repo from "../firebase/operator-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false,
    user: {} as never,
    role: "owner",
    salonId: "s1",
  });
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
});
