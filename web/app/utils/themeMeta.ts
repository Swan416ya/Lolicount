// Static metadata for theme classification, filtering and search on the
// theme gallery page. `kind` is the render type: card = single-layer
// image frames, character = multi-layer PSB sprite composition.
// `gameKey` links the theme to its source game below. `romaji` and
// `aliases` feed the search haystack so users can find a theme by the
// character's Japanese name, romaji or the game name in any locale.

export type ThemeKind = 'card' | 'character' | 'emote'

export type ThemeFrameInfo = {
  character: string
  romaji: string
}

export type ThemeMeta = {
  name: string
  kind: ThemeKind
  gameKey: GameKey
  character: string
  romaji: string
  aliases: string[]
  // Optional per-frame character mapping for multi-character card themes
  // (legacy field kept for card themes that mix characters).
  frames?: ThemeFrameInfo[]
}

export type GameKey =
  | 'summer-pockets'
  | 'otome-domain'
  | 'sanoba-witch'
  | 'nekopara'
  | 'chunithm'
  | 'other'

export const gameMeta: Record<GameKey, { label: Record<'zh' | 'en' | 'jp', string> }> = {
  'summer-pockets': {
    label: { zh: 'Summer Pockets', en: 'Summer Pockets', jp: 'サマーポケッツ' },
  },
  'otome-domain': {
    label: { zh: 'Otome*Domain', en: 'Otome*Domain', jp: 'オトメ＊ドメイン' },
  },
  'sanoba-witch': {
    label: { zh: '魔女的夜宴', en: 'Sabbat of the Witch', jp: 'サノバウィッチ' },
  },
  'nekopara': {
    label: { zh: '猫娘乐园', en: 'NEKOPARA', jp: 'ネコぱら' },
  },
  'chunithm': {
    label: { zh: 'CHUNITHM', en: 'CHUNITHM', jp: 'チュウニズム' },
  },
  other: {
    label: { zh: '其他来源', en: 'Other', jp: 'その他' },
  },
}

export const themeMeta: ThemeMeta[] = [
  // Summer Pockets (card themes)
  { name: 'ao', kind: 'card', gameKey: 'summer-pockets', character: '空門蒼', romaji: 'soramado ao', aliases: ['soramaido ao', 'ao'] },
  { name: 'kamome', kind: 'card', gameKey: 'summer-pockets', character: '久島鴎', romaji: 'kushima kamome', aliases: ['kamome'] },
  { name: 'shiroha', kind: 'card', gameKey: 'summer-pockets', character: '鳴瀬しろは', romaji: 'naruse shiroha', aliases: ['shiroha'] },
  { name: 'wenders', kind: 'card', gameKey: 'summer-pockets', character: '紬ヴェンダース', romaji: 'tsumugi wenders', aliases: ['wenders', 'tsumugi'] },
  { name: 'Kyouko', kind: 'card', gameKey: 'summer-pockets', character: '岬鏡子', romaji: 'misaki kyouko', aliases: ['kyouko'] },
  { name: 'Miki', kind: 'card', gameKey: 'summer-pockets', character: '野村美希', romaji: 'nomura miki', aliases: ['miki'] },
  { name: 'Ryouichi', kind: 'card', gameKey: 'summer-pockets', character: '三谷良一', romaji: 'mitani ryouichi', aliases: ['ryouichi'] },
  { name: 'Tenzen', kind: 'card', gameKey: 'summer-pockets', character: '加納天善', romaji: 'kanou tenzen', aliases: ['tenzen'] },
  { name: 'umi-1', kind: 'card', gameKey: 'summer-pockets', character: '加藤うみ (幼少期)', romaji: 'katou umi', aliases: ['umi', 'katou umi'] },
  { name: 'umi-2', kind: 'card', gameKey: 'summer-pockets', character: '加藤うみ', romaji: 'katou umi', aliases: ['umi'] },

  // Otome*Domain (character themes)
  { name: 'hinata', kind: 'character', gameKey: 'otome-domain', character: '大垣ひなた', romaji: 'ohgaki hinata', aliases: ['oogaki hinata', 'hinata'] },
  { name: 'nanami', kind: 'character', gameKey: 'otome-domain', character: '那波七海', romaji: 'nabanami nanami', aliases: ['nanami'] },
  { name: 'yuzu', kind: 'character', gameKey: 'otome-domain', character: '貴船柚子', romaji: 'kibune yuzu', aliases: ['yuzu'] },
  { name: 'minato', kind: 'character', gameKey: 'otome-domain', character: '飛鳥湊', romaji: 'asuka minato', aliases: ['minato'] },
  { name: 'miyu', kind: 'character', gameKey: 'otome-domain', character: '皆見美結', romaji: 'minami miyu', aliases: ['miyu'] },
  { name: 'furi', kind: 'character', gameKey: 'otome-domain', character: '西園寺風莉', romaji: 'saionji furi', aliases: ['furi'] },

  // Sabbat of the Witch (per-character multi-layer themes)
  { name: 'sanoba-nene', kind: 'character', gameKey: 'sanoba-witch', character: '綾地寧々', romaji: 'ayachi nene', aliases: ['nene', '寧々'] },
  { name: 'sanoba-meguru', kind: 'character', gameKey: 'sanoba-witch', character: '因幡めぐる', romaji: 'inaba meguru', aliases: ['meguru', 'めぐる'] },
  { name: 'sanoba-tsumugi', kind: 'character', gameKey: 'sanoba-witch', character: '椎葉紬', romaji: 'shiiba tsumugi', aliases: ['tsumugi', '紬'] },
  { name: 'sanoba-douko', kind: 'character', gameKey: 'sanoba-witch', character: '戸隠憧子', romaji: 'togakushi douko', aliases: ['douko', '憧子'] },
  { name: 'sanoba-wakura', kind: 'character', gameKey: 'sanoba-witch', character: '仮屋崎和奏', romaji: 'kariyazaki wakura', aliases: ['wakura', '和奏'] },
  { name: 'sanoba-nao', kind: 'character', gameKey: 'sanoba-witch', character: '友成七緒', romaji: 'tomonari nao', aliases: ['nao', '七緒'] },
  { name: 'sanoba-kanae', kind: 'character', gameKey: 'sanoba-witch', character: '水瀬佳苗', romaji: 'minase kanae', aliases: ['kanae', '佳苗'] },
  { name: 'sanoba-hideaki', kind: 'character', gameKey: 'sanoba-witch', character: '秀明', romaji: 'hideaki', aliases: ['hideaki', '秀明'] },
  { name: 'sanoba-taichi', kind: 'character', gameKey: 'sanoba-witch', character: '太一', romaji: 'taichi', aliases: ['taichi', '太一'] },
  { name: 'sanoba-akagi', kind: 'character', gameKey: 'sanoba-witch', character: 'アカギ', romaji: 'akagi', aliases: ['akagi', 'アカギ'] },
  { name: 'sanoba-koshiji', kind: 'character', gameKey: 'sanoba-witch', character: '越路', romaji: 'koshiji', aliases: ['koshiji', '越路'] },

  // Kun Galgame forum mascot (lian = card, lian-ren = character)
  { name: 'lian', kind: 'card', gameKey: 'other', character: '莲', romaji: 'lian', aliases: ['れん', 'ren'] },
  { name: 'lian-ren', kind: 'character', gameKey: 'other', character: '莲', romaji: 'lian ren', aliases: ['れん', 'ren'] },

  // E-mote animated models (NEKOPARA / CHUNITHM / samples)
  { name: 'azuki', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-uniform-a-custard', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'azuki-uniform-b-custard', kind: 'emote', gameKey: 'nekopara', character: 'アズキ', romaji: 'azuki', aliases: ['アズキ'] },
  { name: 'chocola', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-casual-a-bell', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-casual-b-bell', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-date-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-date-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-mid-ex-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-mid-ex-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-pajamas-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-pajamas-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-small-ex-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-small-ex-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-uniform-a-bell', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'chocola-uniform-b-bell', kind: 'emote', gameKey: 'nekopara', character: 'ショコラ', romaji: 'chocola', aliases: ['ショコラ'] },
  { name: 'cinnamon-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-dress-b', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'cinnamon-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'シナモン', romaji: 'cinnamon', aliases: ['シナモン'] },
  { name: 'coconut-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-mid-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-mid-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-shirt-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-small-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-small-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'coconut-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'ココナツ', romaji: 'coconut', aliases: ['ココナツ'] },
  { name: 'fukami', kind: 'emote', gameKey: 'other', character: '深見', romaji: 'fukami', aliases: ['深見'] },
  { name: 'ixia', kind: 'emote', gameKey: 'chunithm', character: 'イクシア', romaji: 'ixia', aliases: ['イクシア'] },
  { name: 'maple-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-dress-b', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'maple-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'メイプル', romaji: 'maple', aliases: ['メイプル'] },
  { name: 'nai', kind: 'emote', gameKey: 'chunithm', character: 'ナイ', romaji: 'nai', aliases: ['ナイ'] },
  { name: 'shigure-casual-a', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-casual-a-headband', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-casual-b', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-casual-b-headband', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-dress-a', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-ex-casual-a', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-ex-casual-b', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-uniform-a', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'shigure-uniform-b', kind: 'emote', gameKey: 'nekopara', character: '時雨', romaji: 'shigure', aliases: ['時雨'] },
  { name: 'vanilla', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-casual-a-bell', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-casual-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-casual-b-bell', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-casual-b-tailpin', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-date-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-date-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-dress-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-mid-ex-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-mid-ex-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-pajamas-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-pajamas-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-small-ex-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-small-ex-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-uniform-a', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-uniform-a-bell', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-uniform-b', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'vanilla-uniform-b-bell', kind: 'emote', gameKey: 'nekopara', character: 'バニラ', romaji: 'vanilla', aliases: ['バニラ'] },
  { name: 'yatai-neko', kind: 'emote', gameKey: 'nekopara', character: '屋台ネコ', romaji: 'yatai neko', aliases: ['屋台ネコ'] },
  { name: 'yuni', kind: 'emote', gameKey: 'chunithm', character: 'ユニ', romaji: 'yuni', aliases: ['ユニ'] },

  // Unconfirmed origin
  { name: 'kuon', kind: 'card', gameKey: 'other', character: 'クオン', romaji: 'kuon', aliases: ['kuon'] },
]

// Build the lowercase haystack used by the search box: theme name,
// character name, romaji, aliases and the game name in all locales.
export const buildSearchHaystack = (meta: ThemeMeta): string => {
  const game = gameMeta[meta.gameKey].label
  const frameParts = (meta.frames ?? []).flatMap((f) => [f.character, f.romaji])
  return [
    meta.name,
    meta.character,
    meta.romaji,
    ...meta.aliases,
    ...frameParts,
    game.zh,
    game.en,
    game.jp,
  ].join(' ').toLowerCase()
}
