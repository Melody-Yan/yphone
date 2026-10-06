/* 同源网易云接口 —— Cloudflare Pages Function，路由就是 /api/netease。
 *
 * 为什么需要它：浏览器直连 music.163.com 会被跨域拦掉，公共 CORS 代理又常年挂
 * （allorigins 实测 520、codetabs 522）。放在同一个域名下就没有跨域这回事。
 *
 * 用法：部署到 Cloudflare Pages 后，App 里「ymusic → 设置 → 网易云接口地址」填
 * /api/netease 即可；留空也能用 —— 导入时会先试这个同源地址。
 * GitHub Pages 是纯静态的，跑不了这个文件，那边只能用别的地址。
 *
 * 上游可以换成任何 Meting 实例，只改下面这一行。
 */
const UPSTREAM = 'https://api.injahow.cn/meting/';

export async function onRequestGet({ request }) {
  const qs = new URL(request.url).searchParams.toString();
  const up = await fetch(UPSTREAM + '?' + qs, {
    headers: { referer: 'https://music.163.com/', 'user-agent': 'Mozilla/5.0' }
  });
  return new Response(up.body, {
    status: up.status,
    headers: {
      'content-type': up.headers.get('content-type') || 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=600'
    }
  });
}
