import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { uploadInvoiceFile, uploadInvoiceText } from '../api';
import type { Invoice } from '../types';

interface Props {
  onUploaded: (invoice: Invoice) => void;
}

interface FileJob {
  file:        File;
  status:      'pending' | 'uploading' | 'done' | 'error' | 'duplicate';
  error?:      string;
  duplicateId?: string;
}

export default function UploadPage({ onUploaded }: Props) {
  const [mode,    setMode]    = useState<'file' | 'text'>('file');
  const [dragging,setDragging]= useState(false);
  const [text,    setText]    = useState('');
  const [jobs,    setJobs]    = useState<FileJob[]>([]);
  const [running, setRunning] = useState(false);
  const [textBusy,setTextBusy]= useState(false);
  const [textErr, setTextErr] = useState<string | null>(null);

  const fileRef   = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const setFolderRef = useCallback((el: HTMLInputElement | null) => {
    (folderRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) el.setAttribute('webkitdirectory', '');
  }, []);

  const updateJob = (idx: number, patch: Partial<FileJob>) =>
    setJobs((prev) => prev.map((j, i) => i === idx ? { ...j, ...patch } : j));

  const runQueue = async (queue: FileJob[]) => {
    setRunning(true);
    for (let i = 0; i < queue.length; i++) {
      updateJob(i, { status: 'uploading' });
      try {
        const inv = await uploadInvoiceFile(queue[i].file);
        updateJob(i, { status: 'done' });
        onUploaded(inv);
      } catch (e) {
        const err = e as Error & { duplicateId?: string };
        if (err.duplicateId) {
          updateJob(i, { status: 'duplicate', error: err.message, duplicateId: err.duplicateId });
        } else {
          updateJob(i, { status: 'error', error: err.message });
        }
      }
    }
    setRunning(false);
  };

  const addFiles = (files: File[]) => {
    const valid = files.filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith('.pdf') || n.endsWith('.txt');
    });
    if (!valid.length) return;
    const newJobs: FileJob[] = valid.map((f) => ({ file: f, status: 'pending' }));
    setJobs((prev) => {
      const updated = [...prev, ...newJobs];
      void runQueue(updated);
      return updated;
    });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addFiles(files);
    e.target.value = '';
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    setTextBusy(true);
    setTextErr(null);
    try {
      const inv = await uploadInvoiceText(text);
      onUploaded(inv);
      setText('');
    } catch (e) {
      setTextErr((e as Error).message);
    } finally {
      setTextBusy(false);
    }
  };

  const clearDone = () =>
    setJobs((prev) => prev.filter((j) => j.status !== 'done'));

  const doneCount    = jobs.filter((j) => j.status === 'done').length;
  const errorCount   = jobs.filter((j) => j.status === 'error').length;
  const pendingCount = jobs.filter((j) => j.status === 'pending' || j.status === 'uploading').length;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-lg font-semibold text-stone-800 mb-1">Dodaj faktury</h1>
      <p className="text-sm text-stone-400 mb-6">
        Wgraj jeden lub wiele plików, cały folder, albo wklej tekst.
      </p>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-5 border border-stone-200 rounded-md p-0.5 w-fit">
        {(['file', 'text'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setTextErr(null); }}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === m ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {m === 'file' ? 'Pliki' : 'Tekst'}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed
              py-14 transition-colors select-none ${
                dragging
                  ? 'border-stone-500 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              }`}
          >
            <svg className="w-8 h-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-stone-500 text-center">
              Przeciągnij pliki tutaj
            </p>
            <p className="text-xs text-stone-400">PDF lub TXT · maks. 10 MB każdy</p>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200
                  hover:bg-stone-100 text-stone-700 transition-colors"
              >
                Wybierz pliki
              </button>
              <button
                onClick={() => folderRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-stone-200
                  hover:bg-stone-100 text-stone-700 transition-colors"
              >
                Wybierz folder
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.txt,application/pdf,text/plain"
              className="sr-only"
              onChange={handleFileChange}
            />
            {/* folder input — webkitdirectory nie ma typów w TS, ustawiamy przez ref */}
            <input
              ref={setFolderRef}
              type="file"
              multiple
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          {/* Queue */}
          {jobs.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-stone-400">
                  {running
                    ? `Wysyłanie… (${doneCount}/${jobs.length})`
                    : `${doneCount} z ${jobs.length} wysłanych${errorCount > 0 ? ` · ${errorCount} błędów` : ''}`
                  }
                </p>
                {!running && doneCount > 0 && (
                  <button
                    onClick={clearDone}
                    className="text-xs text-stone-400 hover:text-stone-700 underline underline-offset-2"
                  >
                    Wyczyść ukończone
                  </button>
                )}
              </div>

              <ul className="space-y-1">
                {jobs.map((job, i) => (
                  <li key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-stone-50 border border-stone-100">
                    <StatusIcon status={job.status} />
                    <span className="flex-1 text-xs text-stone-700 truncate">{job.file.name}</span>
                    <span className="text-xs text-stone-400 shrink-0">
                      {(job.file.size / 1024).toFixed(0)} KB
                    </span>
                    {job.status === 'duplicate' && (
                      <span className="text-xs text-amber-600 shrink-0">już istnieje</span>
                    )}
                    {job.status === 'error' && job.error && (
                      <span className="text-xs text-red-500 shrink-0 max-w-[140px] truncate" title={job.error}>
                        {job.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Wklej tutaj tekst faktury…"
            className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm
              focus:outline-none focus:ring-1 focus:ring-stone-400 resize-none
              text-stone-800 placeholder:text-stone-400"
          />
          {textErr && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {textErr}
            </p>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => void handleTextSubmit()}
              disabled={textBusy || !text.trim()}
              className="px-5 py-2 bg-stone-900 hover:bg-stone-700 disabled:opacity-40
                text-white text-sm font-medium rounded-md transition-colors"
            >
              {textBusy ? 'Wysyłanie…' : 'Prześlij'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: FileJob['status'] }) {
  if (status === 'uploading') return (
    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600 shrink-0" />
  );
  if (status === 'done') return (
    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
  if (status === 'duplicate') return (
    <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
  if (status === 'error') return (
    <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
  return (
    <div className="h-3.5 w-3.5 rounded-full border-2 border-stone-300 shrink-0" />
  );
}
