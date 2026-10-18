import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useSession } from "./state/session";
import Login from "./screens/Login";
import Home from "./screens/Home";
import Album from "./screens/Album";
import Layout from "./components/Layout";

export default function App() {
  const { ready, client, restore } = useSession();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) return null;
  if (!client) return <Login />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="album/:id" element={<Album />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
