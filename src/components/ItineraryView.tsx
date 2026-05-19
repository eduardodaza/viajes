// src/components/ItineraryView.tsx
import React, { useState } from "react";
import type { ItineraryData, ItineraryDay, UserEdits, Locale } from "@/lib/types";
import { t } from "@/lib/i18n";

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  sight:     { label: "sight",  bg: "#e8f5ef", color: "#0f6e56" },
  food:      { label: "food",   bg: "#faeeda", color: "#633806" },
  transport: { label: "move",   bg: "#f4f4f2", color: "#666" },
  event:     { label: "event",  bg: "#eeedfe", color: "#3c3489" },
  alert:     { label: "alert",  bg: "#fcebeb", color: "#a32d2d" },
  beach:     { label: "beach",  bg: "#e6f1fb", color: "#0c447c" },
  night:     { label: "night",  bg: "#1a1a30", color: "#bbb7ff" },
};

interface Props {
  data: ItineraryData;
  locale: Locale;
  onReset: () => void;
}

export default function ItineraryView({ data, locale, onReset }: Props) {
  const [tab, setTab] = useState<"days" | "restaurants" | "events" | "security">("days");
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([0]));
  const [edits, setEdits] = useState<UserEdits>({});
  const [editModal, setEditModal] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");

  function toggleDay(i: number) {
    setOpenDays(prev => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  }

  function openEdit(id: string, name: string) {
    setEditModal({ id, name });
    setEditName(edits[id]?.name ?? name);
    setEditNote(edits[id]?.note ?? "");
  }

  function saveEdit() {
    if (!editModal) return;
    setEdits(prev => ({ ...prev, [editModal.id]: { name: editName, note: editNote } }));
    setEditModal(null);
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "days", label: t("days", locale) },
    { key: "restaurants", label: t("restaurants", locale) },
    { key: "events", label: t("events", locale) },
    { key: "security", label: t("security", locale) },
  ];

  const sd = data.days?.[0]?.date ?? "";
  const ed = data.days?.[data.days.length - 1]?.date ?? "";
  const totalActivities = data.days?.reduce((s, d) => s + d.items.length, 0) ?? 0;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Reset */}
      <button
        onClick={onReset}
        style={{ marginBottom: 12, fontSize: 13, color: "#888", background: "none", border: "1px solid #ede9e2", borderRadius: 8, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
      >
        ← {t("newSearch", locale)}
      </button>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>🗺️</span>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 500, margin: 0, color: "#1a1a18" }}>
            {data.city}, {data.country}
          </h2>
        </div>
        <p style={{ fontSize: 14, color: "#555", marginBottom: 10, fontStyle: "italic" }}>{data.tagline}</p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[
            { val: `${data.days?.length ?? 0}`, lbl: t("days", locale) },
            { val: `${totalActivities}+`, lbl: t("activities", locale) },
            { val: `${data.events?.length ?? 0}`, lbl: t("activeFestivals", locale) },
            { val: data.estimatedBudgetPerDay ?? "–", lbl: t("perDayPerson", locale) },
          ].map(s => (
            <div key={s.lbl} style={{ background: "#f8f7f4", borderRadius: 10, padding: "8px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 500, color: "#1a1a18" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {data.weather && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {[
              `☀️ ${data.weather.maxTemp}°C máx`,
              `🌙 ${data.weather.minTemp}°C mín`,
              data.weather.seaTemp ? `🌊 Mar ${data.weather.seaTemp}°C` : null,
              data.weather.description ? `· ${data.weather.description}` : null,
            ].filter(Boolean).map((s, i) => (
              <span key={i} style={{ fontSize: 12, color: "#666", background: "#f8f7f4", borderRadius: 6, padding: "4px 8px" }}>{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: "7px 14px", fontSize: 13, borderRadius: 20, cursor: "pointer",
              border: `1px solid ${tab === tb.key ? "#1a6b4a" : "#ede9e2"}`,
              background: tab === tb.key ? "#1a6b4a" : "white",
              color: tab === tb.key ? "white" : "#555",
              transition: "all 0.15s",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── DAYS ── */}
      {tab === "days" && data.days?.map((day, di) => (
        <DayCard key={di} day={day} index={di} open={openDays.has(di)}
          onToggle={() => toggleDay(di)} edits={edits} onEdit={openEdit}
          locale={locale} />
      ))}

      {/* ── RESTAURANTS ── */}
      {tab === "restaurants" && (
        <RestaurantsPanel restaurants={data.restaurants} locale={locale} />
      )}

      {/* ── EVENTS ── */}
      {tab === "events" && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>🎭 {t("events", locale)}</h3>
          {data.events?.map((ev, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i < data.events.length - 1 ? "1px solid #f0efea" : "none", display: "flex", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.type === "concert" ? "#e85d26" : ev.type === "permanent" ? "#1a6b4a" : "#7f77dd", marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18" }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: "#3c3489", marginTop: 2 }}>📅 {ev.when} {ev.venue ? `· ${ev.venue}` : ""}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2, lineHeight: 1.5 }}>{ev.description}</div>
                <span style={{ fontSize: 11, background: "#eeedfe", color: "#3c3489", padding: "2px 8px", borderRadius: 8, display: "inline-block", marginTop: 4 }}>{ev.price}</span>
                {ev.ticketUrl && (
                  <a href={ev.ticketUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, marginLeft: 8, color: "#1a6b4a", textDecoration: "underline" }}>
                    {t("bookNow", locale)} ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SECURITY ── */}
      {tab === "security" && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>🛡️ {t("security", locale)}</h3>
          {data.alerts?.map((al, i) => {
            const colors = { alto: "#e24b4a", medio: "#ef9f27", bajo: "#1a6b4a" };
            const badges = { alto: { bg: "#fcebeb", c: "#a32d2d", label: t("riskHigh", locale) }, medio: { bg: "#faeeda", c: "#854f0b", label: t("riskMed", locale) }, bajo: { bg: "#e8f5ef", c: "#0f6e56", label: t("riskLow", locale) } };
            const b = badges[al.level];
            return (
              <div key={i} style={{ padding: "10px 0", borderBottom: i < data.alerts.length - 1 ? "1px solid #f0efea" : "none", display: "flex", gap: 10 }}>
                <div style={{ width: 4, borderRadius: 2, background: colors[al.level], flexShrink: 0, alignSelf: "stretch" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    {al.zone}
                    <span style={{ fontSize: 10, background: b.bg, color: b.c, padding: "1px 7px", borderRadius: 8 }}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 3, lineHeight: 1.5 }}>{al.description}</div>
                  <div style={{ fontSize: 12, color: "#1a6b4a", marginTop: 4 }}>💡 {al.tip}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 360, maxWidth: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>✏️ {t("customize", locale)}: {editModal.name}</h3>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("placeName", locale)}</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>{t("personalNote", locale)}</label>
              <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #ede9e2", borderRadius: 8, fontSize: 13, height: 80, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditModal(null)}
                style={{ flex: 1, padding: 9, border: "1px solid #ede9e2", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 13, color: "#666" }}>
                {t("cancel", locale)}
              </button>
              <button onClick={saveEdit}
                style={{ flex: 2, padding: 9, background: "#1a6b4a", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                {t("saveChanges", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function DayCard({ day, index, open, onToggle, edits, onEdit, locale }: {
  day: ItineraryDay; index: number; open: boolean;
  onToggle: () => void; edits: UserEdits;
  onEdit: (id: string, name: string) => void; locale: Locale;
}) {
  return (
    <div className="card" style={{ marginBottom: 10, padding: 0, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "12px 16px", borderBottom: open ? "1px solid #f0efea" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#1a6b4a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {t("day", locale)} {day.dayNum} · {day.date}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a18", marginTop: 1 }}>{day.theme}</div>
          {day.zone && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>📍 {day.zone}</div>}
        </div>
        <span style={{ fontSize: 18, color: "#aaa", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
      </div>

      {open && day.items.map(item => {
        const edit = edits[item.id] ?? {};
        const name = edit.name ?? item.name;
        const bd = BADGE[item.type] ?? BADGE.sight;
        return (
          <div key={item.id} className="tl-item">
            <div className="tl-time">{item.time}</div>
            <div className="tl-body">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 8px", borderRadius: 10, marginBottom: 4, background: bd.bg, color: bd.color, fontWeight: 500 }}>
                {item.type}
              </span>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18", marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{item.description}</div>
              {edit.note && (
                <div style={{ fontSize: 11, color: "#1a6b4a", marginTop: 4, padding: "4px 8px", background: "#e8f5ef", borderRadius: 6 }}>📝 {edit.note}</div>
              )}
              {item.tip && (
                <div style={{ fontSize: 11, color: "#3c3489", marginTop: 4, padding: "3px 8px", background: "#eeedfe", borderRadius: 6 }}>💡 {item.tip}</div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                {item.duration && <span style={{ fontSize: 11, color: "#888" }}>⏱ {item.duration}</span>}
                {item.transport && item.type !== "transport" && <span style={{ fontSize: 11, color: "#888" }}>🚶 {item.transport} {item.transportTime ?? ""}</span>}
                {item.rating && <span style={{ fontSize: 11, color: "#854f0b" }}>★ {item.rating}</span>}
                {item.price && <span style={{ fontSize: 11, color: "#1a6b4a", fontWeight: 500 }}>{item.price}</span>}
              </div>
              {item.bookingUrl && (
                <a href={item.bookingUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#1a6b4a", textDecoration: "underline", display: "inline-block", marginTop: 4 }}>
                  {t("bookNow", locale)} ↗
                </a>
              )}
              <button onClick={() => onEdit(item.id, name)}
                style={{ fontSize: 10, padding: "2px 8px", border: "1px solid #ede9e2", borderRadius: 6, background: "transparent", color: "#888", cursor: "pointer", marginTop: 6 }}>
                ✏️ {t("customize", locale)}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RestaurantsPanel({ restaurants, locale }: { restaurants: ItineraryData["restaurants"]; locale: Locale }) {
  const tiers = ["$", "$$", "$$$", "$$$$"] as const;
  const tierLabels: Record<string, string> = { "$": t("economico", locale), "$$": t("moderado", locale), "$$$": t("premium", locale), "$$$$": t("lujo", locale) };

  return (
    <>
      {tiers.map(tier => {
        const list = restaurants?.filter(r => r.priceRange === tier) ?? [];
        if (!list.length) return null;
        return (
          <div key={tier} className="card" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
              {tier} · {tierLabels[tier]}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {list.map((r, i) => (
                <div key={i} style={{ border: "1px solid #f0efea", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a18" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{r.type}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "#854f0b" }}>★ {r.rating}</span>
                    <span style={{ fontSize: 11, color: "#1a6b4a", fontWeight: 500 }}>{r.priceRange}</span>
                  </div>
                  {r.specialty && <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>✦ {r.specialty}</div>}
                  {r.zone && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>📍 {r.zone}</div>}
                  {r.source && <div style={{ fontSize: 10, color: "#3c3489", marginTop: 3 }}>{r.source}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
