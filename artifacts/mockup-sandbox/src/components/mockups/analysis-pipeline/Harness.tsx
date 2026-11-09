import { useMemo, useState } from "react";
import "./_group.css";
import { AnalysisProgress, type AnalysisStage } from "./AnalysisStatus";
import type { AnalysisDesk } from "./analysis-progress-model";

const modes = ["Uploading", "Analyzing", "Long wait", "Multi-photo"] as const;

export default function Harness({ width }: { width?: number }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("Analyzing");
  const [desk, setDesk] = useState<AnalysisDesk>("original");
  const startedAt = useMemo(() => Date.now() - (mode === "Long wait" ? 160000 : 25000), [mode]);
  const stage: AnalysisStage = mode === "Uploading" ? "uploading" : "analyzing";
  return (
    <div data-app-theme="rescue" className="investigation-theme min-h-screen bg-[#f4f0e6] p-4" style={{ width, maxWidth: "100%" }}>
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 text-xs ${m === mode ? "bg-[#385e51] text-[#f4f0e6]" : "border-[#d8d1c2] text-[#263d36]"}`}>{m}</button>
        ))}
        <select aria-label="Analysis desk" value={desk} onChange={(e) => setDesk(e.target.value as AnalysisDesk)} className="rounded-full border border-[#d8d1c2] bg-[#fbf9f3] px-3 py-1 text-xs text-[#263d36]">
          <option value="original">Original · Image Locator</option>
          <option value="recreation">Recreation · OpenAI</option>
          <option value="fake-news">Journalism · OpenAI</option>
        </select>
      </div>
      <AnalysisProgress key={mode} stage={stage} startedAt={startedAt} photoCount={mode === "Multi-photo" ? 3 : 1} desk={desk} />
    </div>
  );
}
