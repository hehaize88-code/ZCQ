import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const packs={};
const locales=['en','de','es','fr','it','pl','pt','ro','sv','nl','da','fi','el','cs','hu','bg','sk','hr','sl','lt','lv','et','ga','mt'];
const english=JSON.parse(await readFile('src/content/editorial/en.json','utf8'));
const slugs=english.articles.map(a=>a.slug);
for(const name of (await readdir('src/content/editorial')).filter(x=>x.endsWith('.json'))){
 const value=JSON.parse(await readFile('src/content/editorial/'+name,'utf8'));
 const locale=name.replace('.json','');
 const fail=message=>{throw new Error(name+': '+message);};
 if(!locales.includes(locale))fail('Unsupported editorial locale');
 if(value.faq.length!==28||value.articles.length!==10||value.ui.guideSteps.length!==6)fail('Incomplete FAQ, article or guide content');
 for(const [i,article] of value.articles.entries()){
  const reference=english.articles[i];
  if(article.slug!==reference.slug||article.sections.length!==reference.sections.length)fail('Article structure differs: '+article.slug);
  if(article.related.some(slug=>!slugs.includes(slug)))fail('Unresolved related article');
  for(const [n,section] of article.sections.entries()){
   const original=reference.sections[n];
   if(section.paragraphs.length!==original.paragraphs.length||(section.bullets||[]).length!==(original.bullets||[]).length)fail('Incomplete article section');
   if(locale!=='en'&&section.paragraphs.some((p,j)=>p===original.paragraphs[j]))fail('Untranslated article paragraph');
  }
 }
 if(value.faq.some(item=>item.related&&!slugs.includes(item.related)))fail('Unresolved FAQ article link');
 packs[name.replace('.json','')]=gzipSync(JSON.stringify(value),{level:9}).toString('base64');
}
const missing=locales.filter(locale=>!packs[locale]);
if(missing.length)throw new Error('Editorial locale content is missing: '+missing.join(', '));
await mkdir('.generated',{recursive:true});
await writeFile('.generated/editorial-packs.ts','// Generated from tracked editorial JSON.\nexport const EDITORIAL_PACKS:Record<string,string>='+JSON.stringify(packs)+';\n');
const sitemapPaths=['/','/spreadsheet/','/guide/','/faq/','/articles/',...slugs.map(slug=>'/articles/'+slug+'/')];
await writeFile('.generated/sitemap-paths.ts','// Generated at build time from tracked editorial JSON.\nexport const SITEMAP_PATHS: readonly string[]='+JSON.stringify(sitemapPaths)+';\n');
console.log('Editorial locales packed:',Object.keys(packs).length);
