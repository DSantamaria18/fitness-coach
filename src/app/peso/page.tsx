import type { Metadata } from "next";
import { Card } from "@/components/card";
import { WeightForm } from "./weight-form";

export const metadata: Metadata = {
  title: "Registrar peso — Fitness Coach",
};

export default function PesoPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold text-ink">Registrar peso</h1>
      <Card className="w-full max-w-sm">
        <WeightForm />
      </Card>
    </main>
  );
}
