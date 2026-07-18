import type { Metadata } from "next";
import { WeightForm } from "./weight-form";

export const metadata: Metadata = {
  title: "Registrar peso — Fitness Coach",
};

export default function PesoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Registrar peso</h1>
      <WeightForm />
    </main>
  );
}
