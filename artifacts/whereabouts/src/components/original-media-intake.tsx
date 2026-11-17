import { useEffect, useMemo, useRef, useState,type MutableRefObject } from "react";
import { CropMarks, UploadReceipt } from './field-desk';
import { useQueryClient } from "@tanstack/react-query";
import { Check, FileImage, Film, LoaderCircle, RotateCcw, ScanSearch, Upload, X } from "lucide-react";
import {
  getGetInvestigationSummaryQueryKey,
  getGetLocatorHealthQueryKey,
  getListInvestigationsQueryKey,
  useCreateInvestigation,
  useGetLocatorHealth,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { AnalysisProgress, type AnalysisStage } from "@/components/analysis-status";
import { planSelection, runIntakeItem, type IntakeItem } from "@/lib/original-intake";
import { MAX_ORIGINAL_PHOTOS } from "@/lib/media-types";
import {movePrint} from '@/lib/investigation-steps';
import {PrintInspector} from './desk-controls';
import {departPrint} from '@/lib/print-motion';

type Props = {
  title: string;
  context: string;
  shotAt: string;
  apiKey: string;
  onImageSelected?: (file: File) => void;
  onOpen: (path: string) => void;
  onRunningChange?: (running: boolean) => void;
  onSelectionCountChange?:(count:number)=>void;
  controlsRef?:MutableRefObject<(()=>Promise<boolean>)|null>;
  onStageChange?:(stage:AnalysisStage)=>void;
  maxItems?:number;
};

function ItemPreview({ item }: { item: IntakeItem }) {
  const url = useMemo(() => URL.createObjectURL(item.file), [item.file]);
  const [broken, setBroken] = useState(false);
  const[inspect,setInspect]=useState(false);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  if (item.kind === "video") {
    return <video src={url} controls preload="metadata" className="h-full w-full rounded-lg bg-[#1f3029] object-contain" data-testid={`video-selected-${item.id}`} />;
  }
  if (broken) {
    return <div className="photo-upload-fallback flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg px-2 text-center text-[10px] leading-4" data-testid={`status-preview-unavailable-${item.id}`}><FileImage size={22} />Preview not available — the file will still be analyzed</div>;
  }
  return <><button type="button" className="h-full w-full" aria-label={`Inspect ${item.file.name}`} onClick={()=>setInspect(true)}><img src={url} alt={`Selected photo: ${item.file.name}`} draggable={false} onError={() => setBroken(true)} className="h-full w-full rounded-lg object-contain" data-testid={`img-selected-photo-${item.id}`} /></button>{inspect&&<PrintInspector src={url} alt={item.file.name} onClose={()=>setInspect(false)}/>}</>;
}

export function OriginalMediaIntake({ title, context, shotAt, apiKey, onImageSelected, onOpen, onRunningChange,onSelectionCountChange,controlsRef,onStageChange,maxItems=6 }: Props) {
  const [items, setItems] = useState<IntakeItem[]>([]);
  const selectionCallback=useRef(onSelectionCountChange);selectionCallback.current=onSelectionCountChange;
  useEffect(()=>{selectionCallback.current?.(items.length);},[items.length]);
  const [messages, setMessages] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>("uploading");
  const stageCallback=useRef(onStageChange);stageCallback.current=onStageChange;useEffect(()=>{stageCallback.current?.(stage);},[stage]);
  const dragged=useRef<string|null>(null),listRef=useRef<HTMLUListElement>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [dragging, setDragging] = useState(false);
  const runningRef = useRef(false);
  const onRunningChangeRef = useRef(onRunningChange);
  onRunningChangeRef.current = onRunningChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const client = useQueryClient();
  const uploadUrl = useRequestUploadUrl();
  const create = useCreateInvestigation();
  const health = useGetLocatorHealth({ query: { queryKey: getGetLocatorHealthQueryKey(), retry: false, staleTime: 60_000 } });
  const videoEnabled = health.data?.video_enabled === true;
  const requestUploadUrlRef = useRef(uploadUrl.mutateAsync);
  requestUploadUrlRef.current = uploadUrl.mutateAsync;
  const createRef = useRef(create.mutateAsync);
  createRef.current = create.mutateAsync;

  const patch = (id: string, change: Partial<IntakeItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const addFiles = (list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length || runningRef.current) return;
    const plan = planSelection(itemsRef.current, files, videoEnabled);
    setMessages(plan.errors);
    const kept=plan.items.filter(item=>itemsRef.current.some(old=>old.id===item.id));
    const added=plan.items.filter(item=>!itemsRef.current.some(old=>old.id===item.id));
    if(kept.length+added.length>maxItems)setMessages([...plan.errors,'Up to six selected media items across all desks. Existing selections were kept.']);
    const accepted=[...kept,...added.slice(0,Math.max(0,maxItems-kept.length))];setItems(accepted);
    const firstImage = accepted.find((item) => item.kind === "image" && !itemsRef.current.some((old) => old.id === item.id));
    if (firstImage) onImageSelected?.(firstImage.file);
  };

  const run = async (ids?: string[]) => {
    if (runningRef.current) return false;
    const queue = itemsRef.current.filter((item) => item.status !== "saved" && (!ids || ids.includes(item.id)));
    if (!queue.length) { if(itemsRef.current.length&&itemsRef.current.every(item=>item.status==='saved'))return true;setMessages(["Choose at least one photo before starting the investigation."]); return false; }
    runningRef.current = true;
    setRunning(true);
    onRunningChangeRef.current?.(true);
    setMessages([]);
    setStartedAt(Date.now());
    const savedIds: string[] = [];
    const savedSet = new Set(itemsRef.current.filter((item) => item.status === "saved").map((item) => item.id));
    const total = itemsRef.current.length;
    try {
      for (const item of queue) {
        patch(item.id, { status: "uploading", error: undefined });
        setStage("uploading");
        const outcome = await runIntakeItem(item, {
          title, context, shotAt, apiKey,
          requestUploadUrl: (variables) => requestUploadUrlRef.current(variables),
          uploadFile: async (uploadURL, file, contentType) => {
            const response = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
            if (!response.ok) {
              const error = new Error("The file could not be stored. Please try again.") as Error & { status: number };
              error.status = response.status;
              throw error;
            }
          },
          createInvestigation: (variables) => createRef.current(variables),
          onPhase: (phase) => { setStage(phase); patch(item.id, { status: phase }); },
        });
        patch(item.id, outcome);
        if (outcome.status === "saved" && outcome.savedId) {
          savedIds.push(outcome.savedId);
          savedSet.add(item.id);
          await Promise.all([
            client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }),
            client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() }),
          ]);
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
      onRunningChangeRef.current?.(false);
    }
    const allSaved = savedSet.size === total;
    if (allSaved && savedIds.length) {
      onOpen(savedIds.length === 1 && total === 1 ? `/investigation/${encodeURIComponent(savedIds[0])}` : "/library");
    }
    return allSaved;
  };
  if(controlsRef)controlsRef.current=()=>run();

  const remove = (id: string) => { if (!running) { departPrint(listRef.current?.children[itemsRef.current.findIndex(item=>item.id===id)]);setItems((current) => current.filter((item) => item.id !== id)); setMessages([]); } };
  const pendingCount = items.filter((item) => item.status !== "saved").length;
  const activeVideo = items.some((item) => item.kind === "video");
  const accept = videoEnabled
    ? "image/*,.heic,.heif,.tif,.tiff,.bmp,video/*,.mp4,.mov,.webm,.mkv,.avi,.3gp"
    : "image/*,.heic,.heif,.tif,.tiff,.bmp";

  return (
    <section className="photo-upload-card rounded-2xl border bg-[#f8f5ec] p-3 transition-colors duration-300" data-testid="photo-upload-slot-original">
      <div className="mb-3 flex min-h-12 items-start justify-between gap-3 px-1">
        <div>
          <h2 className="photo-upload-title font-editorial text-xl leading-tight">Investigations</h2>
          <p className="mt-1 text-[11px] leading-4 text-[#78847b]">The image you want to investigate. Add up to {MAX_ORIGINAL_PHOTOS} photos{videoEnabled ? ", or one video" : ""}.</p>
        </div>
      </div>
      <div
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = running ? "none" : "copy"; if (!running) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); addFiles(event.dataTransfer.files); }}
        className={`photo-upload-dropzone relative overflow-hidden rounded-xl border border-dashed text-center transition ${dragging ? "is-dragging" : ""} ${running ? "cursor-wait opacity-70" : ""}`}
        data-testid="dropzone-photo-upload"
      >
        <CropMarks/><span className="fd-drag-label" aria-live="polite">{dragging?'RELEASE TO FILE':items.length?`${String(items.length).padStart(2,'0')} ITEMS / LOCAL SELECTION`:'TRAY EMPTY / 00 ITEMS'}</span>
        <input id="photo-upload-original" type="file" multiple={!activeVideo} accept={accept} disabled={running} className="sr-only" data-testid="input-photo-file"
          onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
        <label htmlFor="photo-upload-original" className={`flex cursor-pointer flex-col items-center justify-center px-4 ${items.length ? "py-4" : "h-[210px] py-5"}`}>
          <span className="photo-upload-icon grid h-12 w-12 place-items-center rounded-full"><Upload size={21} strokeWidth={1.6} /></span>
          <p className="mt-3 font-editorial text-lg">{items.length ? "Add more" : "Drop a photo"}</p>
          <p className="mt-1 text-xs text-[#77847a]">or browse</p>
          <p className="mt-2 text-[10px] text-[#77847a]">Up to 6 images, 25 MB each.{videoEnabled?' Or one video, up to 60 MB.':''}</p>
          <span className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="photo-upload-optional rounded-full border px-3 py-1.5 font-data text-[8px] uppercase tracking-[.1em]">Image · up to 25 MB</span>
            {videoEnabled && <span className="photo-upload-optional rounded-full border px-3 py-1.5 font-data text-[8px] uppercase tracking-[.1em]" data-testid="label-video-limit">Video · up to 60 MB</span>}
          </span>
        </label>
      </div>
      {messages.length > 0 && (
        <div role="alert" className="mt-2 space-y-1 rounded-lg border border-[#dfc6b6] bg-[#f9eee6] px-3 py-2 text-[11px] leading-4 text-[#875545]" data-testid="status-photo-upload-error-original">
          {messages.map((message, index) => <p key={index}>{message}</p>)}
        </div>
      )}
      {items.length > 0 && (
        <ul ref={listRef} className="mt-3 space-y-3" data-testid="list-original-items">
          {items.map((item, index) => (
            <li key={item.id} draggable={!running} onDragStart={e=>{dragged.current=item.id;e.dataTransfer.setData('application/x-whereabouts-print',item.id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{if(dragged.current)e.preventDefault();}} onDrop={e=>{if(!dragged.current)return;e.preventDefault();e.stopPropagation();setItems(current=>movePrint(current,dragged.current!,index));dragged.current=null;}}
              onDragEnd={e=>{if(dragged.current&&e.dataTransfer.dropEffect==='none'&&(e.clientX||e.clientY)){const r=listRef.current?.getBoundingClientRect();if(r&&(e.clientX<r.left-40||e.clientX>r.right+40||e.clientY<r.top-40||e.clientY>r.bottom+40))remove(item.id);}dragged.current=null;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)e.currentTarget.animate([{transform:'translateY(7px)'},{transform:'translateY(0)'}],{duration:250,easing:'cubic-bezier(.2,1,.3,1)'});}}
              className="fd-land-print rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-2.5" data-testid={`item-original-${index}`}>
              <UploadReceipt status={item.status}/>
              <div className="flex gap-3">
                <div className={`shrink-0 overflow-hidden rounded-lg bg-[#e8e9df] ${item.kind === "video" ? "h-28 w-44" : "h-20 w-20"}`}><ItemPreview item={item} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#344b42]">{item.file.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#78847b]">{item.kind === "video" && <Film size={11} />}{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
                  <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${item.status === "error" ? "text-[#875545]" : "text-[#53685d]"}`} role="status" data-testid={`status-item-${index}`}>
                    {(item.status === "uploading" || item.status === "analyzing") && <LoaderCircle size={12} className="animate-spin" />}
                    {item.status === "saved" && <Check size={12} />}
                    {item.status === "ready" && "Ready"}
                    {item.status === "uploading" && "Uploading…"}
                    {item.status === "analyzing" && (item.kind === "video" ? "Saving video…" : "Analyzing…")}
                    {item.status === "saved" && (item.analysisStatus === "analyzing" ? "Saved — analysis running" : "Saved")}
                    {item.status === "error" && (item.error || "Could not be analyzed.")}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button type="button" disabled={running||index===0} onClick={()=>setItems(current=>movePrint(current,item.id,index-1))} className="text-[10px]" aria-label={`Move ${item.file.name} earlier`}>←</button>
                    <button type="button" disabled={running||index===items.length-1} onClick={()=>setItems(current=>movePrint(current,item.id,index+1))} className="text-[10px]" aria-label={`Move ${item.file.name} later`}>→</button>
                    {item.status === "error" && (
                      <button type="button" disabled={running} onClick={() => void run([item.id])} data-testid={`button-retry-item-${index}`} className="inline-flex min-h-8 items-center gap-1.5 text-[11px] font-semibold text-[#385e51] disabled:opacity-50"><RotateCcw size={12} />Try again</button>
                    )}
                    {item.status !== "saved" && (
                      <button type="button" disabled={running} onClick={() => remove(item.id)} data-testid={index === 0 ? "button-remove-photo" : `button-remove-photo-${index}`} className="photo-upload-remove inline-flex min-h-8 items-center gap-1 text-[11px] disabled:opacity-50"><X size={12} />Remove</button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!controlsRef&&running && <AnalysisProgress stage={stage} startedAt={startedAt} photoCount={items.length} desk="original" video={activeVideo && stage === "analyzing"} />}
      {!controlsRef&&!running && items.length > 0 && pendingCount > 0 && (
        <button type="button" onClick={() => void run()} data-testid="button-analyze-photo" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044]">
          {activeVideo ? "Analyze video" : `Analyze ${pendingCount} photo${pendingCount === 1 ? "" : "s"}`} <ScanSearch size={16} />
        </button>
      )}
      {!controlsRef&&!running && items.length === 0 && (
        <button type="button" disabled data-testid="button-analyze-photo" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6] opacity-70">Select photos to analyze <ScanSearch size={16} /></button>
      )}
    </section>
  );
}
