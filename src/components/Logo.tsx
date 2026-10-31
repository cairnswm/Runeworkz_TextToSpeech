import { Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import landing from '../content/landing.json';

export const APP_NAME = landing.appName;

export default function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 min-w-0">
      <span className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0">
        <Volume2 className="w-4 h-4" />
      </span>
      <span className="font-semibold tracking-tight text-slate-800 dark:text-white truncate">{APP_NAME}</span>
    </Link>
  );
}
