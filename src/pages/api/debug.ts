// src/pages/api/debug.ts
// BORRAR DESPUÉS DE DIAGNOSTICAR
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? "✅ presente" : "❌ no encontrada",
    GROQ_API_KEY: process.env.GROQ_API_KEY ? "✅ presente" : "❌ no encontrada",
    NODE_ENV: process.env.NODE_ENV,
  });
}
