"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) {
        params.set("q", next.trim());
      } else {
        params.delete("q");
      }
      router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
    }, 250);
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Search by name or email…"
      className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
    />
  );
}
