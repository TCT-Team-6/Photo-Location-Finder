import { useMemo, useState } from "react";
import "./_group.css";
import { AnalysisProgress, type AnalysisStage } from "./AnalysisStatus";

const modes = ["Uploading", "Analyzing", "Long wait", "Multi-photo"] as const;

export default function Harness({ width }: { width?: number }) {
  const [mode, setMode] = useState<(typeof modes)[number]>("Analyzing");
  const startedAt = useMemo(() => Date.now() - (mode === "Long wait" ? 160000 : 25000), [mode]);
  const stage: AnalysisStage = mode === "Uploading" ? "uploading" : "analyzing";
  return (
    <div data-app-theme="rescue" className="investigation-theme min-h-screen bg-[#f4f0e6] p-4" style={{ width, maxWidth: "100%" }}>
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 text-xs ${m === mode ? "bg-[#385e51] text-[#f4f0e6]" : "border-[#d8d1c2] text-[#263d36]"}`}>{m}</button>
        ))}
      </div>
      <AnalysisProgress key={mode} stage={stage} startedAt={startedAt} photoCount={mode === "Multi-photo" ? 3 : 1} />
    </div>
  );
}
