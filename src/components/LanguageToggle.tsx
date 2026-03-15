import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "fr" | "en";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (fr: string, en: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "fr",
  setLang: () => {},
  t: (fr) => fr,
});

export const useLang = () => useContext(LangContext);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("fr");
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

const LanguageToggle = () => {
  const { lang, setLang } = useLang();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      className="gap-1.5 text-xs font-medium"
    >
      <Languages className="w-4 h-4" />
      {lang === "fr" ? "EN" : "FR"}
    </Button>
  );
};

export default LanguageToggle;
