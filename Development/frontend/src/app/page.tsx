import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root to login
  // The layout will protect dashboard routes
  redirect("/login");
}
