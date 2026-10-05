export type DemoBrandPreview = {
  name: string;
  logo: string;
  accent: string;
  support: string;
};

const STORAGE_KEY = "niche.demo-brand-preview.v1";
const HEX = /^#[0-9a-f]{6}$/i;

export function demoBrandFromSearch(params: URLSearchParams): DemoBrandPreview | null {
  const name = params.get("nome")?.trim().slice(0, 60) || "";
  const logo = params.get("logo") || "";
  const accent = params.get("accento") || "";
  const support = params.get("supporto") || "";
  if (!name && !logo && !accent && !support) return null;
  return {
    name,
    logo: logo.startsWith("data:image/") || /^https?:\/\//i.test(logo) ? logo : "",
    accent: HEX.test(accent) ? accent : "#656b58",
    support: HEX.test(support) ? support : "#aab4bb",
  };
}

export function storeDemoBrandPreview(preview: DemoBrandPreview) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preview));
}

export function clearDemoBrandPreview() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function readDemoBrandPreview(): DemoBrandPreview | null {
  try {
    const preview = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null") as DemoBrandPreview | null;
    if (!preview || !HEX.test(preview.accent) || !HEX.test(preview.support)) return null;
    return preview;
  } catch {
    return null;
  }
}

export function readableOn(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#18201b" : "#ffffff";
}

export function readableAccentOnLight(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#4b514d";
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16) / 255);
  const linear = [r, g, b].map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  const contrastOnWhite = 1.05 / (luminance + .05);
  return contrastOnWhite >= 3.5 ? hex : "#343733";
}

export function readableAccentOnDark(hex: string) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "#f4f7f4";
  const [r, g, b] = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16) / 255);
  const linear = [r, g, b].map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  const darkLuminance = .021;
  const contrastOnDark = (luminance + .05) / (darkLuminance + .05);
  return contrastOnDark >= 3.5 ? hex : "#f4f7f4";
}

export function supportTone(hex: string, strength: number) {
  const clean = HEX.test(hex) ? hex.slice(1) : "aab4bb";
  const channels = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
  const brightness = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  const target = brightness > 238 ? [205, 211, 207] : [255, 255, 255];
  const mixed = channels.map((channel, index) => Math.round(target[index] + (channel - target[index]) * strength));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function mixWithWhite(hex: string, colourAmount: number) {
  const clean = HEX.test(hex) ? hex.slice(1) : "aab4bb";
  const channels = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16));
  const mixed = channels.map((channel) => Math.round(255 + (channel - 255) * colourAmount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
