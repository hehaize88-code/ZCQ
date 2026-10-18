import { createApp } from 'astro/app/entrypoint';
const app = createApp();
export default { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if(url.hostname==='www.pikobuysheet.cc'){url.hostname='pikobuysheet.cc';url.protocol='https:';return Response.redirect(url.href,301);}
  return app.render(request, { locals: {}, waitUntil: ctx?.waitUntil?.bind(ctx) });
}};
