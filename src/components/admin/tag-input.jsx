"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/** Enter/comma to add, click × or Backspace on empty input to remove. */
export function TagInput({ value, onChange, placeholder = "Type and press Enter", id }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="rounded-md border border-input bg-card p-1.5 flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-ring">
      {value.map((tag, i) => (
        <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="rounded-full hover:bg-secondary/20 p-0.5 cursor-pointer"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="h-7 min-w-[140px] flex-1 border-0 shadow-none focus-visible:ring-0 px-1"
      />
    </div>
  );
}
