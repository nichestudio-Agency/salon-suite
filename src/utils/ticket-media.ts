import type { TicketAttachment } from "../domain/models";

const MAX_BYTES = 680_000;
const readDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });

async function compressImage(file: File): Promise<Blob> {
  const image = await createImageBitmap(file); const scale = Math.min(1, 1600 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); const context = canvas.getContext("2d"); if (!context) throw new Error("Immagine non leggibile."); context.drawImage(image, 0, 0, canvas.width, canvas.height); image.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Compressione non riuscita.")), "image/jpeg", .74));
}

export async function prepareTicketAttachment(file: File): Promise<TicketAttachment> {
  const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
  if (blob.size > MAX_BYTES) throw new Error("L’allegato supera 680 KB. Riduci la durata del video o scegli un file più leggero.");
  return { nome: file.type.startsWith("image/") ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name, tipo: blob.type || file.type, dimensione: blob.size, dataUrl: await readDataUrl(blob) };
}

export async function recordScreenClip(maxDurationMs = 15_000): Promise<File> {
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") throw new Error("La registrazione dello schermo non è supportata da questo browser.");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 8 }, audio: false }); const chunks: Blob[] = []; const recorder = new MediaRecorder(stream, { videoBitsPerSecond: 260_000 });
  return await new Promise<File>((resolve, reject) => { const timer = window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, maxDurationMs); recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; recorder.onerror = () => { clearTimeout(timer); stream.getTracks().forEach((track) => track.stop()); reject(new Error("Registrazione non riuscita.")); }; recorder.onstop = () => { clearTimeout(timer); stream.getTracks().forEach((track) => track.stop()); resolve(new File([new Blob(chunks, { type: recorder.mimeType || "video/webm" })], `registrazione-${Date.now()}.webm`, { type: recorder.mimeType || "video/webm" })); }; stream.getVideoTracks()[0]?.addEventListener("ended", () => { if (recorder.state !== "inactive") recorder.stop(); }); recorder.start(500); });
}
