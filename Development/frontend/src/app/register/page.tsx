import { AuthTransitionCard } from "@/components/auth/AuthTransitionCard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Account | ECUlytics Fleet Workspace",
  description: "Set up your operator or researcher profile on ECUlytics platform.",
};

export default function RegisterPage() {
  return <AuthTransitionCard initialMode="register" />;
}
