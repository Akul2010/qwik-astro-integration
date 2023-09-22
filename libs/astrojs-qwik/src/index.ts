import type { AstroIntegration, AstroRenderer } from "astro";
import { qwikRollup } from "@builder.io/qwik/optimizer";
import type { UserConfig } from "vite";

function getRenderer(): AstroRenderer {
  return {
    name: "@astrojs/qwik",
    serverEntrypoint: "@astrojs/qwik/server",
  };
}

async function getRollupConfig(): Promise<UserConfig> {
  const config: UserConfig = {
    plugins: [qwikRollup({})],
  };

  return config;
}

export default function createIntegration(): AstroIntegration {
  return {
    name: "@astrojs/qwik",
    hooks: {
      "astro:config:setup": async ({ addRenderer, updateConfig }) => {
        addRenderer(getRenderer());
        updateConfig({ rollup: await getRollupConfig() });
      },
    },
  };
}