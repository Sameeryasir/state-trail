export type TraceKind =
  | "action:start"
  | "action:success"
  | "action:error"
  | "request:start"
  | "request:success"
  | "request:error"
  | "note";

export interface TraceEvent {
  id: string;
  kind: TraceKind;
  actionId: string | null;
  timestamp: number;
  name: string;
  durationMs?: number;
  status?: number;
  message?: string;
}

export interface ActionGroup {
  actionId: string;
  name: string;
  outcome: "running" | "success" | "error";
  startedAt: number;
  durationMs?: number;
  requestCount: number;
  noteCount: number;
  events: TraceEvent[];
}

export interface TrailReport {
  version: 1;
  generatedAt: string;
  eventCount: number;
  actionCount: number;
  actions: ActionGroup[];
  events: TraceEvent[];
}

export type TraceListener = () => void;
export interface TrailOptions {
  maxEvents?: number;
  enabled?: boolean;
}

const MAX_EVENTS = 200;
const shorten = (value: unknown, max = 200): string => String(value ?? "").slice(0, max);
const createId = (): string => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class Trail {
  private events: TraceEvent[] = [];
  private listeners = new Set<TraceListener>();
  private maxEvents: number;
  readonly enabled: boolean;

  constructor(options: TrailOptions = {}) {
    this.maxEvents = Math.max(1, Math.floor(options.maxEvents ?? MAX_EVENTS));
    this.enabled = options.enabled ?? true;
  }

  getSnapshot = (): readonly TraceEvent[] => this.events;

  subscribe = (listener: TraceListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  clear = (): void => {
    this.events = [];
    this.notify();
  };

  groupByAction = (): ActionGroup[] => groupEventsByAction(this.events);

  exportReport = (): TrailReport => {
    const actions = this.groupByAction();
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      eventCount: this.events.length,
      actionCount: actions.length,
      actions,
      events: this.events.map((event) => ({ ...event })),
    };
  };

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  record(event: Omit<TraceEvent, "id" | "timestamp">): void {
    if (!this.enabled) return;
    const next: TraceEvent = { ...event, id: createId(), timestamp: Date.now() };
    this.events = [...this.events, next].slice(-this.maxEvents);
    this.notify();
  }

  note(name: string, actionId: string | null = null): void {
    this.record({ kind: "note", name: shorten(name), actionId });
  }

  async traceAction<T>(name: string, operation: (action: ActionContext) => T | Promise<T>): Promise<T> {
    const actionId = createId();
    const started = now();
    const safeName = shorten(name, 120);
    this.record({ kind: "action:start", name: safeName, actionId });
    try {
      const result = await operation({
        actionId,
        fetch: (input, init) => this.traceFetch(actionId, input, init),
        note: (label) => this.note(label, actionId),
      });
      this.record({
        kind: "action:success",
        name: safeName,
        actionId,
        durationMs: Math.round(now() - started),
      });
      return result;
    } catch (error) {
      this.record({
        kind: "action:error",
        name: safeName,
        actionId,
        durationMs: Math.round(now() - started),
        message: error instanceof Error ? shorten(error.message) : "Action failed",
      });
      throw error;
    }
  }

  private async traceFetch(actionId: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (
      init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const safePath = sanitizeUrl(url);
    const name = `${shorten(method, 12)} ${safePath}`;
    const started = now();
    this.record({ kind: "request:start", name, actionId });
    try {
      const response = await fetch(input, init);
      this.record({
        kind: response.ok ? "request:success" : "request:error",
        name,
        actionId,
        status: response.status,
        durationMs: Math.round(now() - started),
        ...(response.ok ? {} : { message: `HTTP ${response.status}` }),
      });
      return response;
    } catch (error) {
      this.record({
        kind: "request:error",
        name,
        actionId,
        durationMs: Math.round(now() - started),
        message: "Network request failed",
      });
      throw error;
    }
  }
}

export interface ActionContext {
  actionId: string;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  note: (label: string) => void;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://statetrail.local");
    return shorten(parsed.pathname, 140);
  } catch {
    return "[unavailable-url]";
  }
}

export function groupEventsByAction(events: readonly TraceEvent[]): ActionGroup[] {
  const order: string[] = [];
  const map = new Map<string, TraceEvent[]>();

  for (const event of events) {
    if (!event.actionId) continue;
    if (!map.has(event.actionId)) {
      map.set(event.actionId, []);
      order.push(event.actionId);
    }
    map.get(event.actionId)!.push(event);
  }

  return order.map((actionId) => {
    const groupEvents = map.get(actionId)!;
    const start = groupEvents.find((e) => e.kind === "action:start");
    const end = [...groupEvents].reverse().find((e) => e.kind === "action:success" || e.kind === "action:error");
    return {
      actionId,
      name: start?.name ?? groupEvents[0]?.name ?? "unknown",
      outcome: end?.kind === "action:success" ? "success" : end?.kind === "action:error" ? "error" : "running",
      startedAt: start?.timestamp ?? groupEvents[0]?.timestamp ?? 0,
      durationMs: end?.durationMs,
      requestCount: groupEvents.filter((e) => e.kind.startsWith("request:")).length,
      noteCount: groupEvents.filter((e) => e.kind === "note").length,
      events: groupEvents,
    };
  });
}

export const createTrail = (options?: TrailOptions): Trail => new Trail(options);
