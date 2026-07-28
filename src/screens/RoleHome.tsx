import { useApp } from "@/store/appStore";
import SupervisorHome from "./supervisor/SupervisorHome";
import ChiefHome from "./chief/ChiefHome";
import IeHome from "./ie/IeHome";
import SuperAdminHome from "./superadmin/SuperAdminHome";

export default function RoleHome() {
  const role = useApp((s) => s.user?.role);
  if (role === "super_admin") return <SuperAdminHome />;
  if (role === "supervisor") return <SupervisorHome />;
  if (role === "chief") return <ChiefHome />;
  return <IeHome />;
}
