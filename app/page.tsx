import { redirect } from "next/navigation";
import { getToday } from "@/lib/utils";

export default function Home() {
  redirect(`/digest/${getToday()}`);
}
