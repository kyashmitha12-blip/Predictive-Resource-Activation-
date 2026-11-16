import { Camera, Cpu, FlaskConical, Laptop, Mic, Package, Projector, Tent, Wrench } from "lucide-react";
import type { ComponentType } from "react";

export const categoryIcon: Record<string, ComponentType<{ className?: string }>> = {
  projector: Projector, camera: Camera, audio: Mic, electronics_kit: Cpu, laptop: Laptop, lab_equipment: FlaskConical, tool: Wrench, event_equipment: Tent,
};
export const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  const I = categoryIcon[category] ?? Package;
  return <I className={className} />;
};
