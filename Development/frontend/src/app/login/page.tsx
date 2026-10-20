import { AuthTransitionCard } from "@/components/auth/AuthTransitionCard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | ECUlytics Fleet Workspace",
  description: "Sign in to ECUlytics fleet workspace and battery thermal intelligence platform.",
};

export default function LoginPage() {
  return <AuthTransitionCard initialMode="signin" />;
}
