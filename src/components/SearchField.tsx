import { Search, X } from "lucide-react";
export function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className="notes-search"><Search size={17} aria-hidden="true" /><input aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={label} />{value && <button type="button" onClick={() => onChange("")} aria-label={`清除${label}`}><X size={16} /></button>}</label>;
}
