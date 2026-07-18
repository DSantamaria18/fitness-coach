import { auth } from "@/auth";
import { NavBar } from "./nav-bar";

// Server Component separado de layout.tsx (que envuelve <html>/<body> y es
// incómodo de testear con Testing Library) solo para poder testear con RTL
// si la nav aparece o no según haya sesión, sin arrastrar esa envoltura.
export async function NavBarGate() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return <NavBar />;
}
