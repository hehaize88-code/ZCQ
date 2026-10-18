export default function cloudflareAdapter() {
  return { name: 'pikobuy-cloudflare-ssr', hooks: {
    'astro:config:done': ({ setAdapter }) => setAdapter({
      name: 'pikobuy-cloudflare-ssr', entrypointResolution: 'auto',
      serverEntrypoint: new URL('./entry.mjs', import.meta.url),
      supportedAstroFeatures: { serverOutput: 'stable', staticOutput: 'unsupported', hybridOutput: 'stable' }
    })
  }};
}
