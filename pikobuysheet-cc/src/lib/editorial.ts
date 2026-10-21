import { EDITORIAL_PACKS } from '../../.generated/editorial-packs';
export const SOURCE_URLS:Record<string,string>={guide:'https://www.pikobuy.com/guide',home:'https://www.pikobuy.com/home',shipping:'https://www.pikobuy.com/protocol/shipping',returns:'https://www.pikobuy.com/protocol/returns',estimate:'https://www.pikobuy.com/shipping-cost',contact:'https://www.pikobuy.com/contact',about:'https://www.pikobuy.com/About',terms:'https://www.pikobuy.com/protocol/terms',privacy:'https://www.pikobuy.com/protocol/privacy'};
export type EditorialSection={heading:string,paragraphs:string[],bullets?:string[]};
export type EditorialArticle={slug:string,category:string,title:string,description:string,intro:string,sections:EditorialSection[],sourceIds:string[],related:string[],checks?:string[],published?:string,modified?:string,collection?:string|null};
export type Faq={id:string,group:string,q:string,a:string,sourceIds:string[],related?:string};
export type EditorialData={ui:Record<string,any>,faq:Faq[],articles:EditorialArticle[]};
const decoded=new Map<string,Promise<EditorialData>>();
export function loadEditorial(lang:string):Promise<EditorialData>{
 if(!EDITORIAL_PACKS[lang])throw new Error('Missing editorial locale: '+lang);
 if(!decoded.has(lang))decoded.set(lang,(async()=>{
  const bytes=Uint8Array.from(atob(EDITORIAL_PACKS[lang]),c=>c.charCodeAt(0));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).json() as EditorialData;
 })());
 return decoded.get(lang)!;
}
export function readingMinutes(article:EditorialArticle){const text=[article.intro,...article.sections.flatMap(s=>[s.heading,...s.paragraphs,...(s.bullets||[])])].join(' ');return Math.max(1,Math.ceil(text.split(/\s+/).length/220));}
export function jsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}
