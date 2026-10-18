import { loadEditorial } from './editorial';

export async function getSitemapPaths() {
  const data = await loadEditorial('en');
  return ['/', '/spreadsheet/', '/guide/', '/faq/', '/articles/',
    ...data.articles.map(article => '/articles/' + article.slug + '/')];
}

export function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
