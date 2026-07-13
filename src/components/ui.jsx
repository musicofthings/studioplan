import React, { useState, useEffect, useRef } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { copyText } from "../lib/utils";

export function CopyBtn({ text, label = "Copy", small }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(text || "");
        setDone(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1200);
      }}
      className={
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e7e6e1] bg-white text-[#3a3a44] hover:border-[#c9c8c2] hover:text-[#17171c] transition " +
        (small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm")
      }
    >
      {done ? <Check size={13} className="text-[#0d8a6a]" /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Section({ icon: Icon, title, right, children }) {
  return (
    <div className="rounded-2xl border border-[#e7e6e1] bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0efea]">
        <div className="flex items-center gap-2 text-[#17171c]">
          <Icon size={16} className="text-[#e5342b]" />
          <span className="sp-display text-[15px] font-semibold tracking-tight">{title}</span>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Chip({ children, tone = "ink" }) {
  const map = {
    ink: "bg-[#f4f4f2] text-[#3a3a44] border-[#e7e6e1]",
    red: "bg-[#fdeceb] text-[#c02a20] border-[#f6d3cf]",
    indigo: "bg-[#eeecfb] text-[#3a2fb5] border-[#dcd8f6]",
  };
  return (
    <span className={"sp-mono inline-block rounded-md border px-2 py-0.5 text-[11px] " + map[tone]}>
      {children}
    </span>
  );
}

export function TitleCarousel({ titles }) {
  const [i, setI] = useState(0);
  if (!titles?.length) return <div className="h-6 w-3/4 animate-pulse rounded bg-white/10" />;
  const t = titles[i % titles.length];
  return (
    <div>
      <h2 className="sp-display text-lg font-extrabold leading-snug text-white sm:text-xl">{t.text}</h2>
      <div className="mt-2 flex items-center gap-2">
        <span className="sp-mono text-[10px] text-white/50">{t.style} · {t.score}/10</span>
        <div className="flex gap-1">
          {titles.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              className={"h-1.5 rounded-full transition-all " + (k === i % titles.length ? "w-4 bg-white" : "w-1.5 bg-white/30")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-[#f0efea]" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
      ))}
    </div>
  );
}

export function ScriptLoading({ label, active }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-[#6b6b76]">
      <Loader2 size={15} className={"text-[#e5342b] " + (active ? "animate-spin" : "")} />
      {active ? label : "Queued…"}
    </div>
  );
}
