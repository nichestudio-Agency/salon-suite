export function formatEuro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
}
