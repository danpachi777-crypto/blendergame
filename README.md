# 連続切り / RENZOKUGIRI

スマホの縦画面で遊ぶ、一人称3Dスライスゲーム。指を画面につけたまま、横から届く食材を矢印の方向に切ります。

**公開URL:** https://danpachi777-crypto.github.io/blendergame/

## 現在の試作

- Blender製のキッチン、机、まな板、包丁、4種類の食材。切断後の断面モデルも制作。
- きゅうり ↓ / にんじん ↘ / サーモン → / スイカ ↙。
- 画面のどこでも連続スライド可能。指を戻す動きや方向違いではペナルティなし。
- 60秒チャレンジと、制限時間・見送りのない練習モード。
- 5 / 12 / 25コンボで斬撃・光の粒・音が進化。早く切るとPERFECT、コンボで加点。
- 一時停止、タブを離れた際の自動停止、効果音オン・オフ、端末内の自己ベスト保存。
- 対応端末では短いバイブレーション。iPhone等の非対応環境でもゲームは動作。

## 開発

Node.js 22.13以上。

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
```

同じWi-Fiにある端末では開発サーバーが表示するNetwork URLでも確認できます。通常のスマホ確認には上記の公開URLを使用してください。

`main` へのプッシュで `.github/workflows/pages.yml` がテスト・静的ビルドを行い、GitHub Pagesへ反映します。プッシュ先は `https://github.com/danpachi777-crypto/blendergame.git`。

## 主なファイル

- `app/page.tsx` / `app/globals.css`: 縦画面のUI。
- `app/game.ts`: Three.jsシーン、連続Pointer Events、切断アニメーション、Web Audio。
- `app/slicing.ts`: 方向判定・コンボ・加点。
- `public/models/`: モバイル向けGLB。合計約2.4MB。食材はwhole/halfA/halfBの3グループ。
- `assets-src/renzokugiri.blend`: 編集可能なBlender制作データ。
- `assets-src/create_assets.py`: Blender内でアセットを再生成するスクリプト。
- `public/models/asset-manifest.json`: 座標・オブジェクト名。

UI描画はReact、3DはThree.js。GitHub PagesではViteの静的ビルドを使います。初期Vinext構成も残してあり、`dev:vinext` / `build:vinext` で使用できます。現在のゲームにサーバー・ログイン・データベースは不要です。

## 次に調整したいこと

まず実機でスライドの長さ・切断タイミング・画面の見やすさを確認。追加食材、連続多段切り、フィーバー、包丁のアンロックなどは試遊の感触をもとに決めます。
