"use client";
import { useEffect, useRef, useState } from "react";
import { createGame, type Game, type Snapshot } from "./game";
const initial: Snapshot = {
  phase: "loading",
  score: 0,
  combo: 0,
  best: 0,
  time: 60,
  tier: 0,
  food: "",
  arrow: "↓",
  progress: 1,
  message: "",
  perfect: 0,
  misses: 0,
  practice: false,
};
const tiers = ["静かな刃", "疾風", "光の舞", "極・連続切り"];
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    cue = useRef<HTMLDivElement>(null),
    game = useRef<Game | null>(null);
  const [s, setS] = useState(initial),
    [sound, setSound] = useState(true),
    [error, setError] = useState(""),
    [record, setRecord] = useState(0);
  useEffect(() => {
    let disposed = false;
    createGame(host.current!, setS, (x, y, visible) => {
      if (cue.current) {
        cue.current.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
        cue.current.style.opacity = visible ? "1" : "0";
      }
    })
      .then((g) => {
        if (disposed) g.dispose();
        else game.current = g;
      })
      .catch((e) => {
        console.error(e);
        setError("3Dを読み込めませんでした。再読み込みしてお試しください。");
      });
    try {
      setRecord(Number(localStorage.getItem("renzokugiri-record") || 0));
    } catch {}
    return () => {
      disposed = true;
      game.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (s.phase === "result" && s.score > record) {
      setRecord(s.score);
      try {
        localStorage.setItem("renzokugiri-record", String(s.score));
      } catch {}
    }
  }, [s.phase, s.score, record]);
  const playing = s.phase === "playing",
    start = (practice = false) => game.current?.start(practice);
  return (
    <main className={`app tier-${s.tier}`}>
      <div
        className="scene"
        ref={host}
        aria-label="Blenderで制作した一人称のキッチン"
      />
      <div className="vignette" />
      <header className="topbar">
        <a href="./" className="brand">
          <span className="seal">切</span>
          <span>
            連続切り<small>RENZOKUGIRI</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={sound ? "音をオフ" : "音をオン"}
            onClick={() => {
              setSound(!sound);
              game.current?.setSound(!sound);
            }}
          >
            <Speaker muted={!sound} />
          </button>
          {(playing || s.phase === "paused") && (
            <button
              className="icon-button"
              aria-label={playing ? "一時停止" : "再開"}
              onClick={() => game.current?.pause()}
            >
              {playing ? "Ⅱ" : "▷"}
            </button>
          )}
        </div>
      </header>
      {(playing || s.phase === "paused") && (
        <>
          <section className="hud" aria-label="スコア">
            <div>
              <span className="eyebrow">SCORE</span>
              <strong>{s.score.toLocaleString().padStart(5, "0")}</strong>
            </div>
            <div className="timer">
              <span className="eyebrow">
                {s.practice ? "PRACTICE" : "TIME LEFT"}
              </span>
              <strong className={!s.practice && s.time < 11 ? "urgent" : ""}>
                {s.practice ? "∞" : Math.ceil(s.time)}
                <small>{!s.practice && "s"}</small>
              </strong>
            </div>
          </section>
          <div className="combo" key={s.combo}>
            <span className="combo-number">
              {s.combo}
              <small> COMBO</small>
            </span>
            <span className="combo-title">{tiers[s.tier]}</span>
            <div className="combo-track">
              <i
                style={{
                  width: `${s.tier === 3 ? 100 : (s.combo / [5, 12, 25][s.tier]) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="food-cue" ref={cue}>
            <span>{s.food}</span>
            <b>{s.arrow}</b>
            <div className="deadline">
              <i style={{ transform: `scaleX(${s.progress})` }} />
            </div>
          </div>
          <div
            className={`feedback ${s.message.includes("PERFECT") ? "perfect" : ""}`}
            key={s.message}
          >
            {s.message}
          </div>
          <div className="touch-guide">
            <span className="touch-dot" />
            <span>指を置いたまま、矢印の方向へ</span>
            <small>包丁は指先に追従。画面のどこでも切れます</small>
            <div className="gesture-lines">
              <i />
              <i />
              <i />
            </div>
          </div>
          {s.practice && (
            <button
              className="finish-practice"
              onClick={() => game.current?.finish()}
            >
              練習を終える ↗
            </button>
          )}
        </>
      )}
      {(s.phase === "ready" || s.phase === "loading") && (
        <section className="welcome overlay">
          <div className="welcome-top">
            <span className="edition">
              <i /> 一切りから、無心へ。
            </span>
            <h1>
              切るほど、
              <br />
              <em>気持ちいい。</em>
            </h1>
            <p>
              指を離さず、リズムをつなぐ。
              <br />
              あなたの指先が、一本の包丁になる。
            </p>
          </div>
          <div className="welcome-bottom">
            <div className="howto">
              <span className="howto-arrow">↓ ↘ →</span>
              <p>
                横から届く食材を、矢印の方向にスライド。
                <br />
                連続で切れば、斬撃が進化する。
              </p>
            </div>
            <button
              className="primary-button"
              disabled={s.phase === "loading" || !!error}
              onClick={() => start()}
            >
              <span>
                {error
                  ? "読み込みエラー"
                  : s.phase === "loading"
                    ? "キッチンを準備中…"
                    : "さあ、連続切り"}
              </span>
              <b>↗</b>
            </button>
            {error ? (
              <p className="load-error">{error}</p>
            ) : (
              <>
                <button
                  className="text-button"
                  disabled={s.phase === "loading"}
                  onClick={() => start(true)}
                >
                  まずは、ゆっくり練習する <span>→</span>
                </button>
                <div className="start-meta">
                  <span>60秒チャレンジ</span>
                  <span>BEST {record.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {s.phase === "paused" && (
        <section className="modal-scrim">
          <div className="modal">
            <span className="eyebrow">TAKE A BREATH</span>
            <h2>ひと休み。</h2>
            <p>準備ができたら、続きを切ろう。</p>
            <button
              className="primary-button"
              onClick={() => game.current?.pause()}
            >
              再開する <b>▷</b>
            </button>
            <button
              className="text-button"
              onClick={() => game.current?.finish()}
            >
              ここで終了する
            </button>
          </div>
        </section>
      )}
      {s.phase === "result" && (
        <section className="modal-scrim">
          <div className="modal result">
            <span className="eyebrow">
              {s.practice ? "PRACTICE COMPLETE" : "NICE SLICING"}
            </span>
            <h2>お見事。</h2>
            <p>その一切りに、拍手。</p>
            <div className="result-score">
              <span>SCORE</span>
              <strong>{s.score.toLocaleString()}</strong>
            </div>
            <div className="result-stats">
              <div>
                <b>{s.best}</b>
                <span>最大コンボ</span>
              </div>
              <div>
                <b>{s.perfect}</b>
                <span>PERFECT</span>
              </div>
              <div>
                <b>{s.misses}</b>
                <span>見送り</span>
              </div>
            </div>
            <button
              className="primary-button"
              onClick={() => start(s.practice)}
            >
              もう一度、切る <b>↗</b>
            </button>
            <button
              className="text-button"
              onClick={() => game.current?.home()}
            >
              タイトルに戻る
            </button>
            <small className="best-record">
              自己ベスト {record.toLocaleString()}
            </small>
          </div>
        </section>
      )}
      <div className="home-indicator" />
    </main>
  );
}
function Speaker({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width="20"
      height="20"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
        </>
      )}
    </svg>
  );
}
