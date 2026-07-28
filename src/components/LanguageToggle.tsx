import clsx from "clsx";
import { useApp } from "@/store/appStore";

export default function LanguageToggle() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  return (
    <div className="glass-1 rounded-full p-0.5 flex text-xs font-semibold shadow-pill">
      <button
        onClick={() => setLang("bn")}
        className={clsx(
          "px-2.5 py-1 rounded-full transition",
          lang === "bn" ? "bg-brand text-white" : "text-ink-muted",
        )}
      >
        বাং
      </button>
      <button
        onClick={() => setLang("en")}
        className={clsx(
          "px-2.5 py-1 rounded-full transition",
          lang === "en" ? "bg-brand text-white" : "text-ink-muted",
        )}
      >
        EN
      </button>
    </div>
  );
}
