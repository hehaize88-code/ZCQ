const labels: Record<string, string> = {
  en: 'Site map', de: 'Seitenübersicht', es: 'Mapa del sitio', fr: 'Plan du site',
  it: 'Mappa del sito', pl: 'Mapa strony', pt: 'Mapa do site', ro: 'Harta site-ului',
  sv: 'Webbplatskarta', nl: 'Sitemap', da: 'Sitemap', fi: 'Sivukartta',
  el: 'Χάρτης ιστοτόπου', cs: 'Mapa webu', hu: 'Oldaltérkép', bg: 'Карта на сайта',
  sk: 'Mapa stránok', hr: 'Karta stranice', sl: 'Zemljevid strani', lt: 'Svetainės žemėlapis',
  lv: 'Vietnes karte', et: 'Sisukaart', ga: 'Léarscáil an tsuímh', mt: 'Mappa tas-sit'
};

export const sitemapLabel = (lang: string) => labels[lang] || labels.en;
