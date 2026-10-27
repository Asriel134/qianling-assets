/**
 * 根据调用方已理解的情节选一张插图。无依赖、无网络、无持久化。
 * 地区和行为分别按 OR 匹配；人物与 SFW/NSFW 类别必须明确且一致。
 * 本模块不从正文扫描关键词，不确认图片已显示，也不推进任何图库解锁状态。
 */
const FIXED_BASE = 'https://raw.githubusercontent.com/Asriel134/qianling-assets/892580ef62f82886f222f5b110645a1cad4b5f60/illustrations/images/';
const ASSET_ID = /^nai-[0-9a-f]{20}$/;
const CHARACTERS = new Set(['xian', 'ling', 'ning', 'sui']);
const CONTENT_TYPES = new Set(['SFW', 'NSFW']);
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stringList = value => Array.isArray(value) && value.every(v => typeof v === 'string');
const none = reason => ({ status: 'none', reason });

/**
 * @param {{assets: object[], action_dictionary: object[]}} catalog 当前入选目录。
 * @param {{character_id: string, content_type: 'SFW'|'NSFW', area_ids?: string[], action_tags?: string[], behavior?: string|string[]}} context
 * @param {{usage_counts?: Record<string,number>, recent_asset_ids?: string[], unavailable_ids?: string[], allowed_asset_ids?: string[]}} options
 * @returns {{status:'none',reason:string}|{status:'selected',asset_id:string,image_url:string,character_id:string,content_type:string,matched_action_tags:string[],matched_area_ids:string[],usage_count:number,recent:boolean}}
 *
 * behavior 是调用方已判断的行为短语，只与词典的完整短语比较。
 * allowed_asset_ids 可接收宿主已经批准的可用图片范围；本模块不会自行扩大它。
 * usage_counts 与 recent_asset_ids 都由宿主在真实展示后维护，选择本身不会改动它们。
 */
export function selectIllustration(catalog, context, options = {}) {
  if (!isObject(catalog) || !Array.isArray(catalog.assets) || !Array.isArray(catalog.action_dictionary)) {
    return none('invalid_catalog');
  }
  if (!isObject(context) || !CHARACTERS.has(context.character_id) || !CONTENT_TYPES.has(context.content_type)) {
    return none('explicit_character_and_content_type_required');
  }
  if (!isObject(options)) return none('invalid_options');
  for (const field of ['area_ids', 'action_tags']) {
    if (context[field] !== undefined && !stringList(context[field])) return none('invalid_context_' + field);
  }
  if (context.behavior !== undefined && typeof context.behavior !== 'string' && !stringList(context.behavior)) {
    return none('invalid_context_behavior');
  }
  for (const field of ['recent_asset_ids', 'unavailable_ids', 'allowed_asset_ids']) {
    if (options[field] !== undefined && !stringList(options[field])) return none('invalid_options_' + field);
  }
  if (options.usage_counts !== undefined && !isObject(options.usage_counts)) return none('invalid_usage_counts');

  const actionIds = new Set();
  const phrases = new Map();
  for (const item of catalog.action_dictionary) {
    if (!isObject(item) || typeof item.id !== 'string' || !item.id || typeof item.label !== 'string' ||
        !stringList(item.triggers || [])) return none('invalid_action_dictionary');
    if (actionIds.has(item.id)) return none('duplicate_action_id');
    actionIds.add(item.id);
    for (const word of [item.label, ...(item.triggers || [])]) {
      const key = normalize(word);
      if (!key) continue;
      if (!phrases.has(key)) phrases.set(key, new Set());
      phrases.get(key).add(item.id);
    }
  }
  const requestedActions = new Set((context.action_tags || []).filter(id => actionIds.has(id)));
  const behaviors = typeof context.behavior === 'string' ? [context.behavior] : context.behavior || [];
  for (const word of behaviors) for (const id of phrases.get(normalize(word)) || []) requestedActions.add(id);
  if (!requestedActions.size) return none('recognized_behavior_required');

  const requestedAreas = new Set((context.area_ids || []).filter(Boolean));
  const unavailable = new Set(options.unavailable_ids || []);
  const recent = new Set(options.recent_asset_ids || []);
  const allowed = options.allowed_asset_ids === undefined ? null : new Set(options.allowed_asset_ids);
  const usage = options.usage_counts || {};
  const seenIds = new Set();
  const candidates = [];
  for (const asset of catalog.assets) {
    if (!isObject(asset) || typeof asset.asset_id !== 'string' || !ASSET_ID.test(asset.asset_id)) {
      return none('invalid_asset_identity');
    }
    if (seenIds.has(asset.asset_id)) return none('duplicate_asset_id');
    seenIds.add(asset.asset_id);
    if (asset.active === false || asset.selected === false || unavailable.has(asset.asset_id) ||
        allowed !== null && !allowed.has(asset.asset_id)) continue;
    if (asset.character_id !== context.character_id || asset.content_type !== context.content_type) continue;
    // A missing/changed source is never guessed from the id or accepted from another host/ref.
    if (asset.image_url !== FIXED_BASE + asset.asset_id + '.webp') continue;
    if (!stringList(asset.area_ids) || !stringList(asset.action_tags)) continue;
    const matchedActions = [...new Set(asset.action_tags.filter(id => requestedActions.has(id)))];
    if (!matchedActions.length) continue;
    const matchedAreas = [...new Set(asset.area_ids.filter(id => requestedAreas.has(id)))];
    if (requestedAreas.size && !matchedAreas.length) continue;
    const count = Object.hasOwn(usage, asset.asset_id) && Number.isFinite(usage[asset.asset_id]) && usage[asset.asset_id] >= 0
      ? usage[asset.asset_id] : 0;
    candidates.push({ asset, matchedActions, matchedAreas, count, recent: recent.has(asset.asset_id) });
  }
  if (!candidates.length) return none('no_matching_available_asset');
  // Match conditions have already been checked. Rotation then prevents high-tag-count images monopolizing a scene.
  candidates.sort((a, b) => Number(a.recent) - Number(b.recent) || a.count - b.count ||
    b.matchedActions.length - a.matchedActions.length || b.matchedAreas.length - a.matchedAreas.length ||
    a.asset.asset_id.localeCompare(b.asset.asset_id));
  const chosen = candidates[0];
  return {
    status: 'selected', asset_id: chosen.asset.asset_id, image_url: chosen.asset.image_url,
    character_id: chosen.asset.character_id, content_type: chosen.asset.content_type,
    matched_action_tags: chosen.matchedActions, matched_area_ids: chosen.matchedAreas,
    usage_count: chosen.count, recent: chosen.recent,
  };
}
