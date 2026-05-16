"use client";

const FORMATS = ["Paperback", "Hardcover"];
const RATINGS = [
  { label: "4.5★ & above", value: 4.5 },
  { label: "4★ & above",   value: 4.0 },
  { label: "3.5★ & above", value: 3.5 },
];

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group py-1">
      <div
        onClick={onChange}
        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition flex-shrink-0 ${
          checked ? "bg-[#991B1B] border-[#991B1B]" : "border-stone-300 group-hover:border-stone-400"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm transition ${checked ? "text-[#1C1917] font-semibold" : "text-stone-600 group-hover:text-[#1C1917]"}`}>
        {label}
      </span>
    </label>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-400 mb-3">
      {children}
    </p>
  );
}

export default function FilterPanel({ filters, onChange, onReset, resultCount, isOpen, onToggle }) {
  const { priceMax, formats, minRating, onSaleOnly } = filters;

  const hasActiveFilters =
    priceMax < 2500 ||
    formats.length > 0 ||
    minRating !== null ||
    onSaleOnly;

  const toggleFormat = (fmt) => {
    const next = formats.includes(fmt)
      ? formats.filter((f) => f !== fmt)
      : [...formats, fmt];
    onChange("formats", next);
  };

  return (
    <>
      {/* ── Mobile toggle button ── */}
      <div className="lg:hidden flex items-center justify-between mb-4">
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
            isOpen || hasActiveFilters
              ? "border-[#991B1B] text-[#991B1B] bg-[#991B1B]/5"
              : "border-stone-200 text-stone-600 hover:border-stone-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="bg-[#991B1B] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {[priceMax < 2500, formats.length > 0, minRating !== null, onSaleOnly].filter(Boolean).length}
            </span>
          )}
        </button>

        <p className="text-sm text-stone-500">
          <span className="font-bold text-[#1C1917]">{resultCount}</span> books found
        </p>
      </div>

      {/* ── Panel ── */}
      <div className={`${isOpen ? "block" : "hidden"} lg:block`}>
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sticky top-24 space-y-7">

          {/* Header row */}
          <div className="flex items-center justify-between">
            <h3 className="font-black text-[#1C1917] text-base">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={onReset}
                className="text-xs text-[#991B1B] font-bold hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* ── Price Range ── */}
          <div>
            <SectionTitle>Price Range</SectionTitle>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Up to</span>
                <span className="font-bold text-[#1C1917]">KSh {priceMax.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={500}
                max={2500}
                step={100}
                value={priceMax}
                onChange={(e) => onChange("priceMax", Number(e.target.value))}
                className="w-full accent-[#991B1B] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-400 font-medium">
                <span>KSh 500</span>
                <span>KSh 2,500</span>
              </div>
            </div>
          </div>

          {/* ── Format ── */}
          <div>
            <SectionTitle>Format</SectionTitle>
            <div className="space-y-1">
              {FORMATS.map((fmt) => (
                <CheckRow
                  key={fmt}
                  label={fmt}
                  checked={formats.includes(fmt)}
                  onChange={() => toggleFormat(fmt)}
                />
              ))}
            </div>
          </div>

          {/* ── Minimum Rating ── */}
          <div>
            <SectionTitle>Minimum Rating</SectionTitle>
            <div className="space-y-1">
              {RATINGS.map(({ label, value }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer group py-1">
                  <div
                    onClick={() => onChange("minRating", minRating === value ? null : value)}
                    className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition flex-shrink-0 ${
                      minRating === value
                        ? "bg-[#991B1B] border-[#991B1B]"
                        : "border-stone-300 group-hover:border-stone-400"
                    }`}
                  >
                    {minRating === value && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className={`text-sm transition ${minRating === value ? "text-[#1C1917] font-semibold" : "text-stone-600"}`}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── On Sale ── */}
          <div>
            <SectionTitle>Deals</SectionTitle>
            <label className="flex items-center gap-3 cursor-pointer group py-1">
              <div
                onClick={() => onChange("onSaleOnly", !onSaleOnly)}
                className={`w-11 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${
                  onSaleOnly ? "bg-[#991B1B]" : "bg-stone-200"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                    onSaleOnly ? "left-5" : "left-0.5"
                  }`}
                />
              </div>
              <span className={`text-sm transition ${onSaleOnly ? "text-[#1C1917] font-semibold" : "text-stone-600"}`}>
                On sale only
              </span>
            </label>
          </div>

          {/* Result count — desktop */}
          <div className="hidden lg:block pt-2 border-t border-stone-100">
            <p className="text-sm text-stone-500 text-center">
              <span className="font-bold text-[#1C1917] text-lg">{resultCount}</span> books match
            </p>
          </div>
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-4 lg:mt-3">
          {priceMax < 2500 && (
            <Chip label={`Under KSh ${priceMax.toLocaleString()}`} onRemove={() => onChange("priceMax", 2500)} />
          )}
          {formats.map((f) => (
            <Chip key={f} label={f} onRemove={() => toggleFormat(f)} />
          ))}
          {minRating !== null && (
            <Chip label={`${minRating}★+`} onRemove={() => onChange("minRating", null)} />
          )}
          {onSaleOnly && (
            <Chip label="On sale" onRemove={() => onChange("onSaleOnly", false)} />
          )}
        </div>
      )}
    </>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#991B1B]/10 text-[#991B1B] text-xs font-semibold px-3 py-1.5 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-[#7F1D1D] transition ml-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}