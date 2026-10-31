import { Link } from 'react-router-dom';
import { Volume2, Coins, Copy, FolderOpen, Mic, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import landing from '../content/landing.json';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

const icons: Record<string, LucideIcon> = {
  mic: Mic,
  copy: Copy,
  users: Users,
  coins: Coins,
  folder: FolderOpen,
  shield: ShieldCheck,
};

interface Cta {
  label: string;
  to: string;
}

const container = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';

function Ctas({ primary, secondary }: { primary: Cta; secondary: Cta }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        to={primary.to}
        className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-6 py-3 text-sm font-medium active:scale-95 hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-200"
      >
        {primary.label}
      </Link>
      <Link
        to={secondary.to}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-6 py-3 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        {secondary.label}
      </Link>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Section({ s }: { s: any }) {
  switch (s.type) {
    case 'hero':
      return (
        <section className="py-16 sm:py-24 text-center animate-fade-in">
          <div className={container}>
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Volume2 className="w-10 h-10" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-800 dark:text-white max-w-3xl mx-auto">
              {s.title}
            </h1>
            <p className="mt-6 text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">{s.subtitle}</p>
            <div className="mt-8">
              <Ctas primary={s.primaryCta} secondary={s.secondaryCta} />
            </div>
          </div>
        </section>
      );
    case 'features':
      return (
        <section id={s.id} className="py-16 bg-slate-50 dark:bg-slate-950/40">
          <div className={container}>
            <h2 className="text-2xl font-semibold text-center text-slate-800 dark:text-white">{s.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2 mb-10">{s.subtitle}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((f: { icon: string; title: string; text: string }) => {
                const Icon = icons[f.icon] ?? Mic;
                return (
                  <div key={f.title} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-6">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">{f.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    case 'steps':
      return (
        <section id={s.id} className="py-16">
          <div className={container}>
            <h2 className="text-2xl font-semibold text-center text-slate-800 dark:text-white mb-10">{s.title}</h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {s.items.map((st: { title: string; text: string }, i: number) => (
                <li key={st.title} className="text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold mb-3">
                    {i + 1}
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{st.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      );
    case 'audience':
      return (
        <section className="py-12 bg-slate-50 dark:bg-slate-950/40">
          <div className={`${container} text-center`}>
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">{s.title}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {s.items.map((a: string) => (
                <span key={a} className="px-3 py-1.5 rounded-full text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </section>
      );
    case 'cta':
      return (
        <section className="py-16 sm:py-20 text-center">
          <div className={container}>
            <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">{s.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">{s.subtitle}</p>
            <Ctas primary={s.primaryCta} secondary={s.secondaryCta} />
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700">
        <div className={`${container} h-16 flex items-center justify-between`}>
          <Logo />
          <div className="flex items-center gap-1 sm:gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2">
              Login
            </Link>
            <Link to="/register" className="bg-orange-500 hover:bg-orange-400 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors">
              Register
            </Link>
          </div>
        </div>
      </header>
      <main>
        {landing.sections.map((s, i) => (
          <Section key={i} s={s} />
        ))}
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-700 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} {landing.appName}
      </footer>
    </div>
  );
}
