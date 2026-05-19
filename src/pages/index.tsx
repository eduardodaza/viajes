// src/pages/index.tsx
import React, { useState } from "react";
import Head from "next/head";
import type { TripFormData, ItineraryData, Locale } from "@/lib/types";
import TripForm from "@/components/TripForm";
import Loader from "@/components/Loader";
import ItineraryView from "@/components/ItineraryView";

type AppState = "form" | "loading" | "result";

export default function Home() {
  const [state, setState] = useState<AppState>("form");
  const [itinerary, setItinerary] = useState<ItineraryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastForm, setLastForm] = useState<TripFormData | null>(null);

  async function handleSubmit(form: TripFormData) {
    setLastForm(form);
    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ItineraryData = await res.json();
      setItinerary(data);
      setState("result");
    } catch (err) {
      setError("Failed to generate itinerary. Please try again.");
      setState("form");
    }
  }

  function handleReset() {
    setState("form");
    setItinerary(null);
    setError(null);
  }

  const locale: Locale = lastForm?.locale ?? "es";

  return (
    <>
      <Head>
        <title>TripCraft AI — Itinerarios turísticos inteligentes</title>
        <meta name="description" content="Genera itinerarios turísticos personalizados con IA. Lugares, restaurantes, eventos y alertas de seguridad en segundos." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ minHeight: "100vh", background: "#f8f7f4", paddingTop: 24 }}>
        {state === "form" && (
          <>
            <TripForm onSubmit={handleSubmit} loading={false} />
            {error && (
              <div style={{ maxWidth: 640, margin: "12px auto", padding: "10px 16px", background: "#fcebeb", borderRadius: 8, color: "#a32d2d", fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}
          </>
        )}

        {state === "loading" && lastForm && (
          <Loader city={`${lastForm.city}, ${lastForm.country}`} locale={locale} />
        )}

        {state === "result" && itinerary && (
          <ItineraryView data={itinerary} locale={locale} onReset={handleReset} />
        )}
      </main>
    </>
  );
}
