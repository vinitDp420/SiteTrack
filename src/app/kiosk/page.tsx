"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, UserCheck, HardHat } from "lucide-react";

export default function KioskPage() {
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        if (data.length > 0) setSelectedProject(data[0].id);
        setLoading(false);
      });
  }, []);

  const handleKeyPress = (num: string) => {
    if (input.length < 15) {
      setInput((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setInput("");
    setMessage(null);
  };

  const handleSubmit = async (action: "in" | "out") => {
    if (!input || !selectedProject) {
      setMessage({ text: "Please enter your Phone/ID and select a project", type: "error" });
      return;
    }

    try {
      if (action === "in") {
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: input, projectId: selectedProject, manualBackup: true }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ text: `Welcome ${data.session.worker.name}! Checked In.`, type: "success" });
        } else {
          setMessage({ text: data.error || "Failed to check in", type: "error" });
        }
      } else {
        const res = await fetch("/api/attendance", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workerId: input }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ text: `Goodbye! Checked out.`, type: "success" });
        } else {
          setMessage({ text: data.error || "Failed to check out", type: "error" });
        }
      }
    } catch (err) {
      setMessage({ text: "Network error", type: "error" });
    }
    
    setTimeout(() => {
      setInput("");
      setMessage(null);
    }, 3000);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 font-mono text-white">
      <div className="absolute top-4 right-4 text-xs text-gray-500 flex items-center gap-2">
        <select 
          className="bg-gray-800 text-white border border-gray-700 p-2 rounded outline-none"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span>Site: Kiosk 01</span>
      </div>

      <div className="mb-8 text-center">
        <HardHat className="mx-auto mb-4 h-16 w-16 text-yellow-500" />
        <h1 className="text-3xl font-bold tracking-widest text-gray-100">DIGITAL GATE KIOSK</h1>
        <p className="text-gray-400 mt-2">Enter your Phone No. to Clock In/Out</p>
      </div>

      <div className="w-96 rounded-xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
        <div className="mb-6 rounded bg-gray-900 p-4 text-center shadow-inner overflow-hidden whitespace-nowrap">
          <div className="h-12 text-4xl font-bold tracking-widest text-emerald-400">
            {input || "----------"}
          </div>
        </div>

        {message && (
          <div className={`mb-6 flex items-center justify-center gap-2 rounded p-3 text-sm font-semibold ${
            message.type === 'success' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800' :
            message.type === 'error' ? 'bg-red-900/50 text-red-400 border border-red-800' :
            'bg-blue-900/50 text-blue-400 border border-blue-800'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="flex h-16 items-center justify-center rounded-lg bg-gray-800 text-2xl font-bold transition hover:bg-gray-700 active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="col-span-1 flex h-16 items-center justify-center rounded-lg bg-red-900/50 text-xl font-bold text-red-400 transition hover:bg-red-800/50 active:scale-95"
          >
            CLR
          </button>
          <button
            onClick={() => handleKeyPress("0")}
            className="flex h-16 items-center justify-center rounded-lg bg-gray-800 text-2xl font-bold transition hover:bg-gray-700 active:scale-95"
          >
            0
          </button>
          <button
            onClick={() => setInput(input.slice(0, -1))}
            className="col-span-1 flex h-16 items-center justify-center rounded-lg bg-gray-800 text-xl font-bold transition hover:bg-gray-700 active:scale-95"
          >
            DEL
          </button>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => handleSubmit("in")}
            className="flex-1 rounded-lg bg-emerald-600 py-4 font-bold text-white transition hover:bg-emerald-500 active:scale-95 flex items-center justify-center gap-2"
          >
            <UserCheck className="h-5 w-5" />
            CLOCK IN
          </button>
          <button
            onClick={() => handleSubmit("out")}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 py-4 font-bold text-white transition hover:bg-gray-700 active:scale-95"
          >
            CLOCK OUT
          </button>
        </div>
      </div>
    </div>
  );
}
