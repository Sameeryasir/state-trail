import { useSyncExternalStore, useState, useMemo } from "react";
import type { CSSProperties } from "react";
import type { Trail, TraceEvent, ActionGroup } from "@statetrail/core";

export function useTrailEvents(trail: Trail): readonly TraceEvent[] {
  return useSyncExternalStore(trail.subscribe, trail.getSnapshot, trail.getSnapshot);
}

export function useTrailActions(trail: Trail): ActionGroup[] {
  const events = useTrailEvents(trail);
  return useMemo(() => trail.groupByAction(), [events, trail]);
}

type PanelView = "actions" | "flat";

const font: CSSProperties = {
  fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12.5,
  lineHeight: 1.5,
};

const shell: CSSProperties = {
  ...font,
  background: "linear-gradient(165deg, #071A1C 0%, #0B2428 48%, #0A1C1A 100%)",
  color: "#E7F2F0",
  padding: 18,
  borderRadius: 4,
  border: "1px solid #1F4A4E",
  boxShadow: "0 18px 40px #02101266, inset 0 1px 0 #2A6B6F33",
  position: "relative",
  overflow: "hidden",
};

const btn: CSSProperties = {
  ...font,
  cursor: "pointer",
  border: "1px solid #2F6A6E",
  borderRadius: 3,
  padding: "7px 11px",
  background: "#0E2E32",
  color: "#D7EFEC",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const kindColor = (kind: string): string => {
  if (kind.endsWith("error")) return "#FF8F7A";
  if (kind.endsWith("success")) return "#7DFFB3";
  if (kind === "note") return "#F0C75E";
  return "#6EE7E0";
};

const outcomeStyle = (outcome: ActionGroup["outcome"]): CSSProperties => ({
  color: outcome === "success" ? "#7DFFB3" : outcome === "error" ? "#FF8F7A" : "#F0C75E",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 10,
  fontWeight: 700,
});

export function StateTrailPanel({ trail }: { trail: Trail }) {
  const events = useTrailEvents(trail);
  const actions = useTrailActions(trail);
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<PanelView>("actions");
  const [filter, setFilter] = useState("");
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredActions = actions.filter((action) =>
    `${action.name} ${action.outcome}`.toLowerCase().includes(filter.toLowerCase())
  );
  const filteredEvents = events.filter((event) =>
    `${event.name} ${event.kind}`.toLowerCase().includes(filter.toLowerCase())
  );

  async function exportReport() {
    const report = trail.exportReport();
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      console.info("[StateTrail report]", text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <section aria-label="StateTrail developer panel" style={shell}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: "linear-gradient(180deg, #5EEAD4 0%, #F0C75E 55%, #FF8F7A 100%)",
        }}
      />

      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between", paddingLeft: 8 }}>
        <div>
          <strong style={{ fontSize: 15, letterSpacing: "0.04em" }}>
            StateTrail <span style={{ color: "#5EEAD4", fontWeight: 500 }}>Trail Map</span>
          </strong>
          <p style={{ color: "#8BB5B2", margin: "4px 0 0", fontSize: 11 }}>
            Local memory only • {actions.length} action(s) • {events.length} event(s)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => setView(view === "actions" ? "flat" : "actions")}>
            {view === "actions" ? "Flat log" : "By action"}
          </button>
          <button style={btn} onClick={exportReport}>
            {copied ? "Copied" : "Export JSON"}
          </button>
          <button style={btn} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button style={btn} onClick={() => trail.clear()}>
            Clear
          </button>
        </div>
      </header>

      {expanded && (
        <div style={{ paddingLeft: 8, marginTop: 14 }}>
          <input
            aria-label="Filter trail events"
            placeholder="Filter by action or event…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              ...font,
              padding: 9,
              border: "1px solid #2F6A6E",
              background: "#061617",
              color: "#E7F2F0",
              borderRadius: 3,
              boxSizing: "border-box",
              width: "100%",
              marginBottom: 14,
            }}
          />

          <div style={{ maxHeight: 380, overflow: "auto" }} role="log" aria-live="polite">
            {view === "actions" ? (
              filteredActions.length === 0 ? (
                <p style={{ color: "#8BB5B2" }}>No actions yet. Trigger a traced form submit.</p>
              ) : (
                [...filteredActions].reverse().map((action) => {
                  const isOpen = openAction === action.actionId;
                  return (
                    <div
                      key={action.actionId}
                      style={{
                        borderTop: "1px solid #1F4A4E",
                        padding: "12px 0",
                      }}
                    >
                      <button
                        onClick={() => setOpenAction(isOpen ? null : action.actionId)}
                        style={{
                          ...btn,
                          width: "100%",
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 8,
                          textAlign: "left",
                          background: "transparent",
                          borderColor: "transparent",
                          padding: "2px 0",
                        }}
                        aria-expanded={isOpen}
                      >
                        <span>
                          <span style={outcomeStyle(action.outcome)}>{action.outcome}</span>
                          <div style={{ marginTop: 4, fontSize: 13, color: "#F3FFFD" }}>{action.name}</div>
                          <small style={{ color: "#8BB5B2" }}>
                            {new Date(action.startedAt).toLocaleTimeString()} • {action.noteCount} note(s) •{" "}
                            {action.requestCount} request(s)
                            {action.durationMs !== undefined ? ` • ${action.durationMs}ms` : ""}
                          </small>
                        </span>
                        <span style={{ color: "#5EEAD4", alignSelf: "center" }}>{isOpen ? "▾" : "▸"}</span>
                      </button>

                      {action.durationMs !== undefined && (
                        <div
                          aria-hidden
                          style={{
                            marginTop: 8,
                            height: 3,
                            background: "#12383C",
                            borderRadius: 99,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(8, action.durationMs / 12))}%`,
                              height: "100%",
                              background: action.outcome === "error" ? "#FF8F7A" : "#5EEAD4",
                            }}
                          />
                        </div>
                      )}

                      {isOpen && (
                        <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: "2px solid #2F6A6E" }}>
                          {action.events.map((event) => (
                            <EventRow key={event.id} event={event} compact />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )
            ) : filteredEvents.length === 0 ? (
              <p style={{ color: "#8BB5B2" }}>No events yet.</p>
            ) : (
              [...filteredEvents].reverse().map((event) => <EventRow key={event.id} event={event} />)
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EventRow({ event, compact = false }: { event: TraceEvent; compact?: boolean }) {
  return (
    <div
      style={{
        padding: compact ? "6px 0" : "9px 0",
        borderTop: compact ? "none" : "1px solid #1F4A4E",
        display: "grid",
        gridTemplateColumns: "108px 1fr",
        gap: 8,
      }}
    >
      <span style={{ color: kindColor(event.kind) }}>{event.kind}</span>
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <div>
          {event.name} {event.status ? `(${event.status})` : ""}{" "}
          {event.durationMs !== undefined ? `• ${event.durationMs}ms` : ""}
        </div>
        {!compact && (
          <small style={{ color: "#8BB5B2" }}>
            {new Date(event.timestamp).toLocaleTimeString()} • Action {event.actionId?.slice(0, 8) ?? "—"}
          </small>
        )}
        {event.message && <div style={{ color: "#FF8F7A" }}>{event.message}</div>}
      </div>
    </div>
  );
}
