export async function workspaceRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(body.error?.details || body.error?.message || "요청을 처리하지 못했습니다.");
  return body.data as T;
}
export function jsonRequest(value: unknown, method = "POST"): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}
