/** 固定编号查图；不依赖角色卡宿主 API，也不触发生成或自动切换图片。 */
export function createImageLibrary(manifest, manifestURL) {
  if (manifest?.schema !== 'qianling-illustrations/v1' || !Array.isArray(manifest.assets)) {
    throw new Error('不支持的图片清单');
  }
  const base = new URL('.', manifestURL);
  const index = new Map();
  function resolve(path) {
    if (typeof path !== 'string' || !path || path.includes('\\')) throw new Error('图片路径无效');
    const url = new URL(path, base);
    if (!url.href.startsWith(base.href)) throw new Error('图片路径越出资料库');
    return url.href;
  }
  const fallbackURL = resolve(manifest.fallback);
  for (const asset of manifest.assets) {
    if (!asset.asset_id || index.has(asset.asset_id)) throw new Error('图片固定编号缺失或重复');
    resolve(asset.image); resolve(asset.thumbnail);
    index.set(asset.asset_id, asset);
  }
  return {
    manifest,
    get: id => index.get(id) ?? null,
    list({ character, place, time, contentType } = {}) {
      return manifest.assets.filter(a => (!character || a.character_id === character)
        && (!place || a.places.includes(place)) && (!time || a.scene_times.includes(time))
        && (!contentType || a.content_type === contentType));
    },
    url(id, { thumbnail = false } = {}) {
      const asset = index.get(id);
      return asset ? resolve(thumbnail ? asset.thumbnail : asset.image) : fallbackURL;
    },
    bindImage(element, id, { thumbnail = false } = {}) {
      if (!element) throw new Error('未提供图片元素');
      const asset = index.get(id);
      element.loading = 'lazy'; element.decoding = 'async';
      element.alt = asset?.display_name || asset?.character || '图片暂不可用';
      element.onerror = () => { element.onerror = null; element.src = fallbackURL; };
      element.src = asset ? resolve(thumbnail ? asset.thumbnail : asset.image) : fallbackURL;
      return asset ?? null;
    },
  };
}

export async function loadImageLibrary(manifestURL, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持 fetch');
  const response = await fetchImpl(manifestURL, { signal });
  if (!response.ok) throw new Error('图片清单加载失败：HTTP ' + response.status);
  return createImageLibrary(await response.json(), manifestURL);
}
