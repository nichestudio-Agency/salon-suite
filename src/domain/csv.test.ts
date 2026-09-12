import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "./csv";

describe("CSV", () => {
  it("legge file Excel con separatore punto e virgola e campi quotati", () => {
    expect(parseCsv('Nome;Email;Nota\r\n"Mario Rossi";mario@example.it;"Taglio, barba"')).toEqual([
      ["Nome", "Email", "Nota"], ["Mario Rossi", "mario@example.it", "Taglio, barba"],
    ]);
  });

  it("normalizza le intestazioni", () => {
    expect(csvRecords("Nome e cognome,Prezzo €\nGiulia,25")).toEqual([{ nome_e_cognome: "Giulia", prezzo: "25" }]);
  });
});
