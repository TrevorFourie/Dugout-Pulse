import React from 'react';
import { AlertTriangle, CircleHelp } from 'lucide-react';

export const CrazyPlaysGuide: React.FC = () => (
  <div className="flex-1 min-h-0 overflow-y-auto pb-24 px-4 sm:px-6 pt-4 max-w-2xl mx-auto w-full space-y-5 animate-in fade-in duration-200">
    <header className="rounded-2xl border border-slate-700 bg-[#18212D] dark:bg-[#252D38] p-5 text-white shadow-md sm:p-6">
      <div className="flex items-center gap-2 text-teal-400">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider">Scoring Guide</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold leading-tight">
        Scoring Guide: Crazy Plays & Edge Cases
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        When a play gets chaotic, ignore the drama and focus on one question:
      </p>
      <div className="mt-3 rounded-xl border border-blue-300/50 bg-blue-400/10 px-4 py-3 text-blue-200">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Golden Rule</p>
        <p className="mt-1 text-lg font-semibold">What did MY player personally do?</p>
      </div>
    </header>

    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-500">01 / Fielding</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">The Core Fielding Actions</h2>
      </div>

      <article className="rounded-xl border border-red-900/40 bg-[#18212D] dark:bg-[#252D38] p-4 text-white shadow-xs">
        <h3 className="text-base font-semibold"><span className="text-red-400">E</span> <span className="text-slate-300">(Error)</span></h3>
        <p className="mt-1 text-sm font-semibold text-white">Did he make a mistake that kept a play alive?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Tap E when a misplayed ball, such as a dropped throw, muffed grounder, or bad throw, lets a batter reach safely or a runner advance.
        </p>
        <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-relaxed text-blue-200">
          Wild pitches and passed balls are recorded on the Pitching or catcher actions, not as fielding errors.
        </p>
      </article>

      <article className="rounded-xl border border-teal-900/40 bg-[#18212D] dark:bg-[#252D38] p-4 text-white shadow-xs">
        <h3 className="text-base font-semibold"><span className="text-teal-300">PO</span> <span className="text-slate-300">(Putout)</span></h3>
        <p className="mt-1 text-sm font-semibold text-white">Did he record the actual out himself?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Tap PO whenever your player directly secures an out: catching a fly ball or pop-up, catching a strikeout, tagging a runner, or stepping on a base for a force out.
        </p>
      </article>

      <article className="rounded-xl border border-blue-900/40 bg-[#18212D] dark:bg-[#252D38] p-4 text-white shadow-xs">
        <h3 className="text-base font-semibold"><span className="text-blue-300">A</span> <span className="text-slate-300">(Assist)</span></h3>
        <p className="mt-1 text-sm font-semibold text-white">Did he throw or deflect the ball to help make an out?</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Tap A when your player fields or deflects the ball to a teammate who then completes the out.
        </p>
      </article>
    </section>

    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-500">02 / Examples</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">Common Crazy Plays</h2>
      </div>

      <article className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white">
        <h3 className="flex items-start gap-2 font-extrabold">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          Error and putout on the same play?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Yes. If your player drops the ball (E), recovers it, gets to the bag, and tags the runner out himself (PO), tap E and then PO. The app logs both actions.
        </p>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white">
        <h3 className="flex items-start gap-2 font-extrabold">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          Fielding error, wild pitch, or passed ball?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          If your player is pitching and throws a ball past the catcher, record a <strong className="text-white">WP (Wild Pitch)</strong> on the Pitching screen. If your player is catching and misses a catchable pitch, record a <strong className="text-white">PB (Passed Ball)</strong>. Neither is a standard fielding Error (E).
        </p>
      </article>

      <article className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-white">
        <h3 className="flex items-start gap-2 font-extrabold">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          Great throw, but his teammate dropped it?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Do not give your player an Error. The error belongs to the teammate who dropped the ball. Your player receives no stat penalty for the good throw.
        </p>
      </article>
    </section>

    <section className="rounded-2xl border border-teal-700/50 bg-gradient-to-r from-[#18212D] dark:from-[#252D38] to-[#1E2937] dark:to-[#1A2028] p-4 text-white shadow-md sm:p-5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400">03 / Remember</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed sm:text-base">
        Score actions, not outcomes. If he touched the ball, log his specific action (PO, A, or E). If he wasn&apos;t involved in the play, do nothing—the app handles the rest!
      </p>
    </section>
  </div>
);
