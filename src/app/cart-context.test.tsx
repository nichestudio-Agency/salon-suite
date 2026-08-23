import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "./cart-context";
import type { ProductWithId } from "../firebase/product-repo";

const cera: ProductWithId = { id: "p1", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true };

function Harness() {
  const cart = useCart();
  return (
    <div>
      <span data-testid="count">{cart.items.length}</span>
      <span data-testid="total">{cart.totale}</span>
      <button onClick={() => cart.add("s1", cera)}>add</button>
      <button onClick={() => cart.clear()}>clear</button>
    </div>
  );
}

describe("cart-context", () => {
  it("aggiunge, incrementa la quantità e calcola il totale", async () => {
    render(<CartProvider><Harness /></CartProvider>);
    await userEvent.click(screen.getByText("add"));
    await userEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("count").textContent).toBe("1"); // stessa riga, qta 2
    expect(screen.getByTestId("total").textContent).toBe("3000");
    await userEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("total").textContent).toBe("0");
  });
});
