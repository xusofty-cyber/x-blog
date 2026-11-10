import type { PerkCategory } from './perks.constants';

function hasLatinToken(title: string, word: string): boolean {
  const pattern = new RegExp(`(?:^|[^A-Za-z])${word}(?:[^A-Za-z]|$)`, 'i');
  return pattern.test(title);
}

function isLowRelevance(title: string): boolean {
  return (
    /抽奖|开奖|抽取|求购|收购|求助|闲聊|讨论|新闻|资讯|公告|更新|评测|测评|避雷|吐槽|预测/.test(
      title,
    ) ||
    /(?:^|[\s【\[])(?:收|求)(?:购|助|一个|一下|个)?(?:[A-Za-z0-9._-]{0,16}|团队|管理员|家庭|企业|共享|朋友|个人|学生|开发者|机场)?[\s:：]*(?:优惠码|会员|账号|主机|路由器|套餐|商品|上车|自建)/.test(
      title,
    ) ||
    /[?？]/.test(title) ||
    /有没有|有无|是否|请问|是真的吗|能不能|可不可以/.test(title)
  );
}

/**
 * Title-based heuristic classification (first match wins).
 */
export function classifyPerk(title: string, sourceId: string): PerkCategory {
  if (sourceId === 'epic') return '游戏';
  if (isLowRelevance(title)) return '其他';

  if (
    hasLatinToken(title, 'epic') ||
    title.includes('游戏') ||
    title.includes('喜加一') ||
    hasLatinToken(title, 'steam')
  ) {
    return '游戏';
  }
  if (
    title.includes('会员') ||
    title.includes('订阅') ||
    title.includes('会员版') ||
    hasLatinToken(title, 'pro')
  ) {
    return '会员订阅';
  }
  if (title.includes('限免') || title.includes('免费领取')) {
    return '限免';
  }
  if (title.includes('白嫖') || title.includes('免费') || title.includes('永免')) {
    return '免费白嫖';
  }
  if (
    title.includes('折扣') ||
    title.includes('优惠码') ||
    title.includes('大促') ||
    title.includes('降价') ||
    title.includes('打折') ||
    title.includes('爆降')
  ) {
    return '低价优惠';
  }
  return '其他';
}

