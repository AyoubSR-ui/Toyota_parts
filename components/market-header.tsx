'use client';
import { AutoPartLogo } from '@/components/auto-part-logo';
import { useLocale,LanguagePicker } from '@/components/locale';
export function MarketHeader(){const {t,locale}=useLocale();return <header className="topbar market-topbar"><div className="shell topbar-inner"><a className="brand" href="/"><AutoPartLogo/></a><nav className="nav market-nav"><a href="/#stores">{t("المتاجر")}</a><a href="/dashboard">{t("لوحة متجري")}</a><a href="/account">{t("تسجيل الدخول")}</a><LanguagePicker/></nav></div></header>;}
