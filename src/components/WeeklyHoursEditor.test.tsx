import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyHoursEditor } from "./WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";

describe("WeeklyHoursEditor", () => {
  it("mostra le fasce esistenti come HH:MM", () => {
    const value: WeeklyHours = { lun: [{ start: 540, end: 1140 }] };
    render(<WeeklyHoursEditor value={value} onChange={() => {}} />);
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("19:00")).toBeInTheDocument();
  });

  it("aggiunge una fascia a un giorno vuoto e notifica onChange in minuti", async () => {
    const onChange = vi.fn();
    render(<WeeklyHoursEditor value={{}} onChange={onChange} />);
    // Ogni giorno ha un bottone "Aggiungi fascia"; clic sul primo (lunedì).
    const addButtons = screen.getAllByRole("button", { name: /aggiungi fascia/i });
    await userEvent.click(addButtons[0]);
    // Default della nuova fascia: 09:00–17:00 (540–1020).
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ lun: [{ start: 540, end: 1020 }] })
    );
  });

  it("rimuove una fascia", async () => {
    const onChange = vi.fn();
    render(
      <WeeklyHoursEditor value={{ lun: [{ start: 540, end: 1140 }] }} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole("button", { name: /rimuovi fascia/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lun: [] }));
  });
});
