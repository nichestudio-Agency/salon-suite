import { httpsCallable } from "firebase/functions";
import { functions } from "./app";

export async function runBirthdayGreetings(date?: string): Promise<{ count: number }> {
  const callable = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
  const res = await callable(date ? { date } : {});
  return res.data;
}
