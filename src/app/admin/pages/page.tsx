import { redirect } from "next/navigation";

export default function PriceTableRedirect() {
  redirect("/admin/prices");
}
