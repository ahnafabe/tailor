import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProviders } from "./state/AppContext";
import { ClaudeArtifactStore } from "./platform/store";
import { ClaudeSampleClient } from "./platform/ai";
import "./styles.css";

async function start() {
  const store = new ClaudeArtifactStore();
  const ai = new ClaudeSampleClient();
  await Promise.all([store.init(), ai.init()]);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProviders store={store} ai={ai}><App /></AppProviders>
    </StrictMode>,
  );
}
start();
