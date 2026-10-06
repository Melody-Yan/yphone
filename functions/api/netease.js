/* 同源网易云接口 —— Cloudflare Pages Function，路由就是 /api/netease。
 *
 * 为什么需要它：浏览器直连 music.163.com 会被跨域拦掉，公共 CORS 代理又常年挂
 * （allorigins 实测 520、codetabs 522）。放在同一个域名下就没有跨域这回事。
 *
 * 用法：部署到 Cloudflare Pages 后不用配任何东西 —— 导入时会先试这个同源地址；
 * 也可以在「ymusic → 设置 → 网易云接口地址」里显式填 /api/netease。
 * GitHub Pages 是纯静态的，跑不了这个文件，那边只能用别的地址。
 *
 * 转发给 Meting 拿歌（它返回的 url 是能直接播的），再补一次网易云详情，
 * 把 Meting 不提供的歌单名和封面带上 —— 否则歌单卡片只能显示「网易云歌单」。
 * 上游可以换成任何 Meting 实例，只改下面这一行。
 */
const UPSTREAM = 'https://api.injahow.cn/meting/';
const DETAIL = 'https://music.163.com/api/v6/playlist/detail?id=';
const HEADERS = { referer: 'https://music.163.com/', 'user-agent': 'Mozilla/5.0' };

const json = (body, headers) => new Response(JSON.stringify(body), { status: 200, headers });

export async function onRequestGet({ request }) {
  const params = new URL(request.url).searchParams;
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=600'
  };
  const up = await fetch(UPSTREAM + '?' + params.toString(), { headers: HEADERS });
  const text = await up.text();

  /* 歌单：顺手把歌单名/封面补上。补不到就原样返回，别把导入搞挂。 */
  if (up.ok && params.get('type') === 'playlist' && params.get('id')) {
    let tracks = null;
    try { tracks = JSON.parse(text); } catch (e) { tracks = null; }
    if (Array.isArray(tracks)) {
      let name = '', cover = '';
      try {
        const meta = await fetch(DETAIL + encodeURIComponent(params.get('id')) + '&n=1', { headers: HEADERS });
        const pl = (await meta.json()).playlist;
        if (pl) { name = pl.name || ''; cover = pl.coverImgUrl || ''; }
      } catch (e) { /* 拿不到名字不影响放歌 */ }
      return json({ name, cover, tracks }, headers);
    }
  }

  headers['content-type'] = up.headers.get('content-type') || headers['content-type'];
  return new Response(text, { status: up.status, headers });
}
