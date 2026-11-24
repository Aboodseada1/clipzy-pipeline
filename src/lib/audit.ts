import { prisma } from "@/lib/prisma";

export async function audit(input: {
  userId?: string;
  action: string;
  category: string;
  targetType?: string;
  targetId?: string;
  detail?: any;
  ip?: string;
}) {
  return prisma.auditLog.create({ data: input });
}
