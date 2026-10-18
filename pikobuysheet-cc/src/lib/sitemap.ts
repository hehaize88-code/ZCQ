import { SITEMAP_PATHS } from '../../.generated/sitemap-paths';

export function getSitemapPaths() {
  return SITEMAP_PATHS;
}

export function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
