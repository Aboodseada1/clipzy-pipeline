import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");
  return <LoginClient />;
}

import LoginClient from "./login-client";
