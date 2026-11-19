// 多语言：index.html 开头的小脚本按浏览器语言选好（?lang=ja 这样可以强制），写在 <html lang> 上，这里照着读。
// 代码里一律写 t('中文', 'English')：中文环境用中文、英文环境用英文，其他语言按英文原句去 i18n-dict.js 里查，查不到就用英文。
import { DICT } from './i18n-dict.js';
const H = document.documentElement.lang || 'en';
export const LANG = H === 'zh-CN' ? 'zh' : H;
const D = DICT[LANG];
const tr = (zh, en) => { const v = D[en]; return v === undefined ? en : v === null ? zh : v; }; // null：直接用中文原句（繁体里带变量的那句）
export const t = (zh, en) => {
  if (LANG === 'zh') return zh;
  if (!D) return en;
  return typeof en === 'object' ? Object.fromEntries(Object.keys(en).map((k) => [k, tr(zh[k], en[k])])) : tr(zh, en);
};
const CJK = LANG === 'zh' || LANG === 'zh-TW';
// 国家名：简体中文用资产目录里的中文名；其他语言用浏览器自带的地区名（按国家代码）
const region = (() => { try { return new Intl.DisplayNames([LANG], { type: 'region' }); } catch { return null; } })();
export const countryName = (b) => (LANG === 'zh' ? b.region || b.country : (b.country && region?.of(b.country)) || b.region || b.country);
// 国家排序：简体中文环境中国排第一、其余按拼音；其他语言按当地的字母顺序
export function sortCountries(rows) { // rows: [{ code, name }]
  return rows.sort((a, b) => (LANG === 'zh' ? ((b.code === 'CN') - (a.code === 'CN')) || a.name.localeCompare(b.name, 'zh-CN') : a.name.localeCompare(b.name, LANG)));
}
// 别人的名字：服务器同时给中文名和英文名；中文（简繁）用中文名，其他用英文名
export const nameOf = (p) => (p ? (CJK ? p.name : p.nameEn || p.name) : '');
