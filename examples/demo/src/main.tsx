import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createTrail } from "@statetrail/core";
import { StateTrailPanel } from "@statetrail/react";
import "./styles.css";

const trail = createTrail({ maxEvents: 150, enabled: import.meta.env.DEV });

function App() {
  const [name, setName] = useState("Alex Rivera");
  const [email, setEmail] = useState("alex@example.com");
  const [savedName, setSavedName] = useState("Not saved yet");
  const [status, setStatus] = useState("Submit the form — the trail map updates live below.");

  function validateForm(): string | null {
    if (!name.trim()) return "Name is required";
    if (!email.trim()) return "Email is required";
    if (!email.includes("@")) return "Email must look like an address";
    return null;
  }

  async function saveSuccessfully(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Tracing save-profile…");

    try {
      await trail.traceAction("save-profile", async ({ fetch, note }) => {
        const validationError = validateForm();
        if (validationError) {
          note(`Validation failed: ${validationError}`);
          throw new Error(validationError);
        }
        note("Form validation passed");

        const response = await fetch("https://jsonplaceholder.typicode.com/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        });

        if (!response.ok) throw new Error(`Save failed: HTTP ${response.status}`);

        note("Profile saved on server");
        setSavedName(name.trim());
      });

      setStatus(`Saved “${name.trim()}”. Expand the action in the trail map, or Export JSON.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function saveWithFailure() {
    setStatus("Tracing save-profile-fail…");

    try {
      await trail.traceAction("save-profile-fail", async ({ fetch, note }) => {
        const validationError = validateForm();
        if (validationError) {
          note(`Validation failed: ${validationError}`);
          throw new Error(validationError);
        }
        note("Form validation passed");

        const response = await fetch(
          "https://jsonplaceholder.typicode.com/invalid-route?api_key=not-recorded",
          { method: "GET" }
        );

        if (!response.ok) throw new Error(`Save failed: HTTP ${response.status}`);
      });

      setStatus("Unexpected success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    }
  }

  return (
    <main className="layout">
      <header className="brand">
        <div className="brand-mark">
          <i className="trail-dot" aria-hidden />
          <span>npm-ready prototype</span>
        </div>
        <h1>StateTrail</h1>
        <p>
          Opt-in action trails for React: validation notes, fetch outcomes, and a
          shareable report — all correlated to one click.
        </p>
      </header>

      <div className="stage">
        <section className="capabilities" aria-label="Package capabilities">
          <div className="cap">
            <strong>Trace actions</strong>
            <span>Wrap a save/submit in traceAction() and get a full start→end story.</span>
          </div>
          <div className="cap">
            <strong>Group by action</strong>
            <span>Related notes + requests stay under one actionId in the trail map.</span>
          </div>
          <div className="cap">
            <strong>Export JSON</strong>
            <span>Copy a sanitized bug report from the panel — local memory only.</span>
          </div>
        </section>

        <section className="panel">
          <h2>Profile form</h2>
          <p className="hint">
            Saved as: <strong>{savedName}</strong>
          </p>

          <form className="form" onSubmit={saveSuccessfully}>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <div className="buttons">
              <button className="primary" type="submit">
                Save (success trail)
              </button>
              <button className="ghost-fail" type="button" onClick={saveWithFailure}>
                Save (failure trail)
              </button>
            </div>
          </form>

          <p className="status" role="status">
            {status}
          </p>
        </section>

        <StateTrailPanel trail={trail} />
      </div>

      <p className="footnote">
        Tip: clear a field and save to see a validation note. Use <em>By action</em> / <em>Export JSON</em>
        in the trail map. Query strings and bodies are never recorded. No data leaves this browser.
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
