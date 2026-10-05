const emulatorProjectId = import.meta.env?.VITE_FIREBASE_PROJECT_ID ?? "demo-barbershop";

type RestValue = Record<string, unknown>;

function decodeRestValue(value: RestValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: RestValue[] }).values ?? [];
    return values.map(decodeRestValue);
  }
  if ("mapValue" in value) {
    return decodeRestFields((value.mapValue as { fields?: Record<string, RestValue> }).fields ?? {});
  }
  return undefined;
}

function decodeRestFields(fields: Record<string, RestValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeRestValue(value)]));
}

export async function getEmulatorDocument(path: string, idToken?: string): Promise<Record<string, unknown> | null> {
  const endpoint = `http://localhost:8085/v1/projects/${encodeURIComponent(emulatorProjectId)}/databases/(default)/documents/${path}`;
  const response = await fetch(endpoint, idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore emulator: ${response.status}`);
  const payload = await response.json() as { fields?: Record<string, RestValue> };
  return decodeRestFields(payload.fields ?? {});
}

export interface EmulatorDocument extends Record<string, unknown> {
  id: string;
}

/** Legge una collection dall'emulatore senza WebChannel, che può bloccarsi in WKWebView. */
export async function getEmulatorCollection(path: string, idToken?: string): Promise<EmulatorDocument[]> {
  const endpoint = `http://localhost:8085/v1/projects/${encodeURIComponent(emulatorProjectId)}/databases/(default)/documents/${path}?pageSize=200`;
  const response = await fetch(endpoint, idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : undefined);
  if (!response.ok) throw new Error(`Firestore emulator: ${response.status}`);
  const payload = await response.json() as {
    documents?: Array<{ name: string; fields?: Record<string, RestValue> }>;
  };
  return (payload.documents ?? []).map((document) => ({
    id: decodeURIComponent(document.name.split("/").at(-1) ?? ""),
    ...decodeRestFields(document.fields ?? {}),
  }));
}
