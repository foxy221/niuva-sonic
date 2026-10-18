import { useEffect } from "react";
import { useSession } from "./state/session";
import Login from "./screens/Login";
import Home from "./screens/Home";

export default function App() {
  const { ready, client, restore } = useSession();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) return null;
  return client ? <Home /> : <Login />;
}
