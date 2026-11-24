import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

// Runtime config — operator-editable, no redeploy. Validated client-side and
// stored as JSON; consumers read strongly-typed values via getConfig<T>().
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  const rec = await prisma.runtimeConfig.findUnique({ where: { key } });
  return (rec?.value as T) ?? null;
}

export async function setConfig<T = unknown>(key: string, value: T, userId?: string) {
  const rec = await prisma.runtimeConfig.upsert({
    where: { key },
    update: { value: value as any, updatedBy: userId },
    create: { key, value: value as any, updatedBy: userId },
  });
  await audit({ userId, action: "config.update", category: "config", targetType: "runtime_config", targetId: rec.id, detail: { key, value } });
  return rec;
}

export async function listConfig() {
  return prisma.runtimeConfig.findMany({ orderBy: { key: "asc" } });
}

export async function getFlag(key: string) {
  const f = await prisma.systemFlag.findUnique({ where: { key } });
  return !!f?.value;
}

export async function setFlag(key: string, value: boolean, userId?: string, note?: string) {
  const rec = await prisma.systemFlag.upsert({
    where: { key },
    update: { value, note: note ?? undefined },
    create: { key, value, note: note ?? undefined },
  });
  await audit({ userId, action: "system.flag", category: "system", targetType: "system_flag", targetId: rec.id, detail: { key, value } });
  return rec;
}
