// src/components/Loader.tsx
import React, { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";

interface Props { city: string; locale: Locale; }

const STEPS_KEYS = [
  "loadingStep1","loadingStep2","loadingStep3","loadingStep4","loadingStep5",
];

export default function Loader({ city, locale }: Props) {
  const [current, setCurrent] = useState(0);
  const steps = STEPS_KEYS.map(k => t(k, locale));

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="card" style={{ maxWidth: 560, margin: "32px auto", textAlign: "center", padding: "2rem 1.5rem" }}>
      {/* Spinner */}
      <div style={{
        width: 40, height: 40, border: "2.5px solid #ede9e2",
        borderTopColor: "#1a6b4a", borderRadius: "50%",
        animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "#1a1a18", marginBottom: 4 }}>
        {city}
      </p>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>{steps[current]}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>
              {i < current ? "✅" : i === current ? "⏳" : "○"}
            </span>
            <span style={{ color: i <= current ? "#1a6b4a" : "#bbb" }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
