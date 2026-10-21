import { AnalysisProgress } from "./Source";
import "./_group.css";
export default function Current() {
  return <div data-app-theme="rescue" className="min-h-screen bg-[#f4f0e6] p-4"><AnalysisProgress stage="analyzing" startedAt={Date.now() - 25000} photoCount={1} /></div>;
}
