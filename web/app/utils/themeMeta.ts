// Static metadata for theme classification, filtering and search on the
// theme gallery page. `kind` is the render type: card = single-layer
// image frames, character = multi-layer PSB sprite composition.
// `gameKey` links the theme to its source game below. `romaji` and
// `aliases` feed the search haystack so users can find a theme by the
// character's Japanese name, romaji or the game name in any locale.

export type ThemeKind = 'card' | 'character'

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
  // (e.g. sanoba mixes 11 characters in one frame set).
  frames?: ThemeFrameInfo[]
}

export type GameKey =
  | 'summer-pockets'
  | 'otome-domain'
  | 'sanoba-witch'
  | 'kun-forum'
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
  'kun-forum': {
    label: { zh: 'KUNgal', en: 'KUNgal', jp: 'KUNgal' },
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

  // Sabbat of the Witch (card theme)
  {
    name: 'sanoba',
    kind: 'card',
    gameKey: 'sanoba-witch',
    character: '魔女的夜宴 全角色',
    romaji: 'sanoba witch',
    aliases: ['sabbat'],
    frames: [
      { character: '綾地寧々', romaji: 'ayachi nene' },
      { character: '綾地寧々', romaji: 'ayachi nene' },
      { character: '綾地寧々', romaji: 'ayachi nene' },
      { character: '宍戸める', romaji: 'shishido meguru' },
      { character: '宍戸める', romaji: 'shishido meguru' },
      { character: '因幡めぐる', romaji: 'inaba meguru' },
      { character: '因幡めぐる', romaji: 'inaba meguru' },
      { character: '戸隠憧子', romaji: 'togakushi douko' },
      { character: '戸隠憧子', romaji: 'togakushi douko' },
      { character: '仮屋崎和奏', romaji: 'kariyazaki wakana' },
      { character: '仮屋崎和奏', romaji: 'kariyazaki wakana' },
      { character: '椎葉紬', romaji: 'shiiba tsumugi' },
      { character: '椎葉紬', romaji: 'shiiba tsumugi' },
      { character: '椎葉紬', romaji: 'shiiba tsumugi' },
      { character: '綾地寧々（巫女服）', romaji: 'ayachi nene miko' },
      { character: '戸隠憧子（体操服）', romaji: 'togakushi douko gym' },
      { character: '友成七緒', romaji: 'tomonari nao' },
      { character: '水瀬佳苗', romaji: 'minase kanae' },
      { character: '仮屋崎和奏（外套）', romaji: 'kariyazaki wakana coat' },
    ],
  },

  // Kun Galgame forum mascot (lian = card, lian-ren = character)
  { name: 'lian', kind: 'card', gameKey: 'kun-forum', character: '莲', romaji: 'lian', aliases: ['れん', 'ren'] },
  { name: 'lian-ren', kind: 'character', gameKey: 'kun-forum', character: '莲', romaji: 'lian ren', aliases: ['れん', 'ren'] },

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
