import { defineConfig } from "vite";

// En production (GitHub Pages), l'app est servie sous https://<user>.github.io/ilaria-algo/
// donc les chemins d'assets doivent être préfixés par « /ilaria-algo/ ».
// En développement local, on garde « / » pour http://localhost:5173/.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ilaria-algo/" : "/",
}));
