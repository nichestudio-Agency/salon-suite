import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProductWithId } from "../firebase/product-repo";

export interface CartLine {
  product: ProductWithId;
  qta: number;
}

interface CartState {
  salonId: string | null;
  items: CartLine[];
  totale: number;
  add: (salonId: string, product: ProductWithId) => void;
  setQta: (productId: string, qta: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve essere usato dentro CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [salonId, setSalonId] = useState<string | null>(null);
  const [items, setItems] = useState<CartLine[]>([]);

  function add(nextSalonId: string, product: ProductWithId) {
    setItems((prev) => {
      // Il carrello è per singolo salone: cambiando salone si svuota.
      const base = nextSalonId === salonId ? prev : [];
      const existing = base.find((l) => l.product.id === product.id);
      if (existing) {
        return base.map((l) =>
          l.product.id === product.id ? { ...l, qta: l.qta + 1 } : l,
        );
      }
      return [...base, { product, qta: 1 }];
    });
    setSalonId(nextSalonId);
  }

  function setQta(productId: string, qta: number) {
    setItems((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, qta } : l))
        .filter((l) => l.qta > 0),
    );
  }

  function remove(productId: string) {
    setItems((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function clear() {
    setItems([]);
    setSalonId(null);
  }

  const totale = useMemo(
    () => items.reduce((sum, l) => sum + l.product.prezzo * l.qta, 0),
    [items],
  );

  return (
    <CartContext.Provider value={{ salonId, items, totale, add, setQta, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}
