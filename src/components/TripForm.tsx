// src/components/TripForm.tsx
import React, { useState, useEffect } from "react";
import type { TripFormData, Budget, TravelerType, Locale } from "@/lib/types";
import { t, LOCALES } from "@/lib/i18n";

const INTERESTS = [
  "🏛️ Historia & Cultura", "🍽️ Gastronomía", "🌿 Naturaleza",
  "🎵 Vida nocturna", "🛍️ Compras", "🎨 Arte & Museos",
  "🧗 Aventura", "📷 Fotografía", "🧘 Bienestar", "👨‍👩‍👧 Familiar",
  "🏖️ Playas", "⚽ Deporte",
];

const BUDGETS: Budget[] = ["economico", "moderado", "premium", "lujo"];
const BUDGET_ICONS: Record<Budget, string> = {
  economico: "💰", moderado: "💳", premium: "💎", lujo: "🏆",
};

interface Props { onSubmit: (data: TripFormData) => void; loading: boolean; }

export default function TripForm({ onSubmit, loading }: Props) {
  const [locale, setLocale] = useState<Locale>("es");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [travelerType, setTravelerType] = useState<TravelerType>("pareja");
  const [budget, setBudget] = useState<Budget>("moderado");
  const [interests, setInterests] = useState<string[]>(["🏛️ Historia & Cultura", "🍽️ Gastronomía"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState("");

  useEffect(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    setStartDate(today.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    const sd = new Date(startDate + "T12:00:00");
    const ed = new Date(endDate + "T12:00:00");
    if (ed < sd) { setDateRange(""); return; }
    const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
    const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    setDateRange(`${fmt(sd)} → ${fmt(ed)} · ${days} día${days > 1 ? "s" : ""}`);
  }, [startDate, endDate]);

  function toggleInterest(i: string) {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!city.trim()) errs.city = t("errorRequired", locale);
    if (!country.trim()) errs.country = t("errorRequired", locale);
    if (!startDate) errs.startDate = t("errorRequired", locale);
    if (!endDate) errs.endDate = t("errorRequired", locale);
    if (startDate && endDate && new Date(endDate) < new Date(startDate))
      errs.endDate = t("errorDateRange", locale);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSubmit({ city, country, startDate, endDate, travelers, travelerType, budget, interests, locale });
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
      {/* Hero */}
      <div className="card" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28 }}>🗺️</span>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, color: "#1a1a18", margin: 0 }}>
            TripCraft AI
          </h1>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{t("appTagline", locale)}</p>
        </div>
        {/* Language selector */}
        <div style={{ marginLeft: "auto" }}>
          <select
            value={locale}
            onChange={e => setLocale(e.target.value as Locale)}
            style={{ fontSize: 13, border: "1px solid #ede9e2", borderRadius: 8, padding: "4px 8px", background: "white" }}
          >
            {LOCALES.map(l => (
              <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        {/* Destination */}
        <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          📍 {t("city", locale)} & {t("country", locale)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("city", locale)}</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Ej: Barcelona"
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${errors.city ? "#e24b4a" : "#ede9e2"}`, borderRadius: 8, fontSize: 13 }}
            />
            {errors.city && <p style={{ color: "#e24b4a", fontSize: 11, marginTop: 3 }}>{errors.city}</p>}
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("country", locale)}</label>
            <input
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="Ej: España"
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${errors.country ? "#e24b4a" : "#ede9e2"}`, borderRadius: 8, fontSize: 13 }}
            />
            {errors.country && <p style={{ color: "#e24b4a", fontSize: 11, marginTop: 3 }}>{errors.country}</p>}
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #f0efea", margin: "0 0 14px" }} />

        {/* Dates */}
        <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          📅 {t("startDate", locale)} — {t("endDate", locale)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("startDate", locale)}</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${errors.startDate ? "#e24b4a" : "#ede9e2"}`, borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("endDate", locale)}</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${errors.endDate ? "#e24b4a" : "#ede9e2"}`, borderRadius: 8, fontSize: 13 }}
            />
            {errors.endDate && <p style={{ color: "#e24b4a", fontSize: 11, marginTop: 3 }}>{errors.endDate}</p>}
          </div>
        </div>
        {dateRange && (
          <div style={{ background: "#f8f7f4", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "#555", marginBottom: 14, border: "1px solid #ede9e2" }}>
            📆 {dateRange}
          </div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid #f0efea", margin: "0 0 14px" }} />

        {/* Travelers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("travelers", locale)}</label>
            <input
              type="number"
              min={1} max={20}
              value={travelers}
              onChange={e => setTravelers(Number(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("travelerType", locale)}</label>
            <select
              value={travelerType}
              onChange={e => setTravelerType(e.target.value as TravelerType)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13, background: "white" }}
            >
              {(["pareja","familia","amigos","solo","negocios"] as TravelerType[]).map(tt => (
                <option key={tt} value={tt}>{t(tt, locale)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Budget */}
        <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          💳 {t("budget", locale)}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {BUDGETS.map(b => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              style={{
                flex: 1, padding: "7px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${budget === b ? "#e85d26" : "#ede9e2"}`,
                background: budget === b ? "#fdf0eb" : "white",
                color: budget === b ? "#e85d26" : "#666", transition: "all 0.15s",
              }}
            >
              {BUDGET_ICONS[b]} {t(b, locale)}
            </button>
          ))}
        </div>

        {/* Interests */}
        <div style={{ fontSize: 11, fontWeight: 500, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          ❤️ {t("interests", locale)}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {INTERESTS.map(i => (
            <span
              key={i}
              className={`chip${interests.includes(i) ? " on" : ""}`}
              onClick={() => toggleInterest(i)}
            >
              {i}
            </span>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", padding: "13px", fontSize: 15, fontWeight: 500,
            borderRadius: 10, background: loading ? "#aaa" : "#1a6b4a",
            color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity 0.2s",
          }}
        >
          ✨ {t("generateBtn", locale)}
        </button>
      </div>
    </div>
  );
}
