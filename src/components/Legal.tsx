import { useState, type ReactNode } from 'react';
import { ANALYTICS_AVAILABLE, clearLocalData, getConsent, setConsent, STORAGE_KEYS, type Consent } from '../lib/consent';
import { SITE } from '../lib/site';
import type { Section } from '../lib/state';
import { Button } from './ui';

export type LegalPage = 'datenschutz' | 'nutzung' | 'cookies' | 'erstattung';
export const LEGAL_PAGES: { value: LegalPage; label: string }[] = [
  { value: 'datenschutz', label: 'Datenschutz' },
  { value: 'nutzung', label: 'Nutzungsbedingungen' },
  { value: 'cookies', label: 'Cookies' },
  { value: 'erstattung', label: 'Rückerstattung' },
];
export const isLegal = (s: Section): s is LegalPage => LEGAL_PAGES.some((p) => p.value === s);

function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 font-display text-lg font-bold leading-tight">{children}</h3>;
}
const P = ({ children }: { children: ReactNode }) => <p className="mt-2 leading-relaxed">{children}</p>;
const UL = ({ children }: { children: ReactNode }) => <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{children}</ul>;
const A = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">{children}</a>;

const contact = SITE.contactEmail ? <>per E-Mail an <span className="select-all font-medium">{SITE.contactEmail}</span></> : null;

/** Auswahl zur Besucherzählung; wird im Banner und auf der Cookie-Seite verwendet. */
export function ConsentChoice({ onChange }: { onChange?: (c: Consent) => void }) {
  const [value, setValue] = useState<Consent>(() => getConsent());
  const choose = (v: 'ja' | 'nein') => {
    setConsent(v);
    setValue(v);
    onChange?.(v);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={value === 'nein' ? 'primary' : 'ghost'} onClick={() => choose('nein')}>Ablehnen</Button>
      <Button variant={value === 'ja' ? 'primary' : 'ghost'} onClick={() => choose('ja')}>Erlauben</Button>
      <span role="status" className="text-[13px] text-muted">
        {value === 'ja' ? 'Besucherzählung ist erlaubt.' : value === 'nein' ? 'Besucherzählung ist abgelehnt.' : 'Noch keine Entscheidung getroffen.'}
      </span>
    </div>
  );
}

/** Einwilligungs-Hinweis: erscheint, solange keine Entscheidung getroffen wurde. Beide Knöpfe sind gleichwertig. */
export function ConsentBanner({ onMore }: { onMore: () => void }) {
  const [open, setOpen] = useState(() => ANALYTICS_AVAILABLE && getConsent() === null);
  if (!open) return null;
  return (
    <div role="region" aria-label="Einwilligung zur Besucherzählung" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[560px] rounded-card border border-line bg-surface p-4 shadow-lg" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <p className="text-sm font-semibold">Anonyme Besucherzählung erlauben?</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        Diese Seite setzt keine Cookies. Wenn du zustimmst, wird gezählt, wie oft die Seite aufgerufen wird, ohne Cookies und ohne dich wiederzuerkennen. Deine Eingaben in den Rechnern werden nie übertragen.{' '}
        <button type="button" onClick={onMore} className="font-medium text-accent underline underline-offset-2">Mehr dazu</button>
      </p>
      <div className="mt-3"><ConsentChoice onChange={() => setOpen(false)} /></div>
    </div>
  );
}

function Datenschutz() {
  return (
    <>
      <P>Diese Erklärung beschreibt, welche Daten beim Besuch von {SITE.domain} verarbeitet werden. Kurz gesagt: so wenige wie möglich. Es gibt keine Anmeldung, keine Formulare, die etwas absenden, keine Werbung und keine Cookies.</P>
      <H>Verantwortlich</H>
      <P>Betreiber dieser privaten, nicht kommerziellen Webseite: {SITE.operator}{SITE.place ? `, ${SITE.place}` : ''}.{contact ? <> Anfragen zum Datenschutz {contact}.</> : ''}</P>
      <H>Deine Eingaben in den Rechnern</H>
      <P>Alle Berechnungen laufen in deinem Browser. Beträge, Einkommen, Ausgaben und alle anderen Eingaben werden nicht an einen Server übertragen und sind für den Betreiber nicht einsehbar. Damit deine Werte beim nächsten Besuch noch da sind, speichert sie dein Browser auf deinem Gerät. Du kannst sie jederzeit auf der Seite „Cookies“ löschen.</P>
      <H>Aufruf der Webseite (Hosting)</H>
      <P>Die Seite wird bei Vercel Inc. (USA) gehostet. Beim Aufruf verarbeitet Vercel technisch notwendige Verbindungsdaten wie IP-Adresse, Zeitpunkt, aufgerufene Datei und Browserkennung, um die Seite auszuliefern und Angriffe abzuwehren. Rechtsgrundlage ist das berechtigte Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Dabei können Daten in den USA verarbeitet werden. Näheres in der <A href="https://vercel.com/legal/privacy-policy">Datenschutzerklärung von Vercel</A>.</P>
      <H>Besucherzählung nur mit Einwilligung</H>
      <P>Wenn du zustimmst, wird Vercel Web Analytics geladen. Der Dienst zählt Seitenaufrufe und arbeitet laut Anbieter ohne Cookies und ohne dauerhafte Wiedererkennung einzelner Personen. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Ohne Zustimmung wird das Zählskript nicht geladen. Du kannst deine Entscheidung jederzeit auf der Seite „Cookies“ ändern.</P>
      <H>Keine weiteren Drittanbieter</H>
      <P>Schriftarten, Symbole und Programmcode werden von {SITE.domain} selbst geladen. Es sind keine Inhalte von Google, sozialen Netzwerken, Karten- oder Videodiensten eingebunden.</P>
      <H>Speicherdauer</H>
      <P>Auf deinem Gerät gespeicherte Eingaben bleiben, bis du sie löschst. Verbindungsdaten beim Hoster werden nach dessen Vorgaben gelöscht.</P>
      <H>Deine Rechte</H>
      <P>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht, eine Einwilligung jederzeit zu widerrufen. Außerdem kannst du dich bei der österreichischen Datenschutzbehörde beschweren (<A href="https://www.dsb.gv.at">dsb.gv.at</A>).</P>
    </>
  );
}

function Nutzung() {
  return (
    <>
      <H>1. Was {SITE.name} ist</H>
      <P>{SITE.name} ist ein kostenloser Rechner für Kredite, Finanzierungen und Vermietung. Die Nutzung ist ohne Anmeldung möglich. Mit der Nutzung akzeptierst du diese Bedingungen.</P>
      <H>2. Keine Beratung, kein Angebot</H>
      <P>Alle Ergebnisse sind Modellrechnungen auf Grundlage deiner eigenen Eingaben und Annahmen. Sie sind keine Finanz-, Anlage-, Steuer- oder Rechtsberatung, kein Kreditangebot und keine Kreditzusage. Banken rechnen je nach Vertrag anders. Triff finanzielle Entscheidungen nicht allein auf Grundlage dieser Seite und hole verbindliche Angebote und fachliche Beratung ein.</P>
      <H>3. Richtigkeit und Aktualität</H>
      <P>Die Berechnungen werden sorgfältig erstellt und geprüft. Trotzdem wird keine Gewähr für Richtigkeit, Vollständigkeit und Aktualität übernommen, insbesondere nicht für Gebühren-, Steuersätze und aufsichtliche Orientierungswerte, die sich ändern können.</P>
      <H>4. Haftung</H>
      <P>Die Nutzung erfolgt auf eigene Verantwortung. Die Haftung für leichte Fahrlässigkeit ist ausgeschlossen, ausgenommen Personenschäden. Für Vorsatz und grobe Fahrlässigkeit gelten die gesetzlichen Bestimmungen. Zwingende Rechte von Verbraucherinnen und Verbrauchern bleiben unberührt.</P>
      <H>5. Verfügbarkeit</H>
      <P>Es besteht kein Anspruch darauf, dass die Seite jederzeit erreichbar ist oder Funktionen unverändert bleiben. Gespeicherte Eingaben liegen nur in deinem Browser und können dort verloren gehen. Sichere wichtige Berechnungen als Datei.</P>
      <H>6. Erlaubte Nutzung</H>
      <P>Du darfst die Seite privat und beruflich für eigene Berechnungen nutzen und Ergebnisse exportieren. Nicht erlaubt sind Angriffe auf die Seite, automatisierte Massenabfragen und das Ausgeben der Seite oder ihrer Inhalte als eigenes Angebot.</P>
      <H>7. Links zu anderen Seiten</H>
      <P>Für Inhalte verlinkter fremder Seiten sind ausschließlich deren Betreiber verantwortlich.</P>
      <H>8. Änderungen und anwendbares Recht</H>
      <P>Diese Bedingungen können angepasst werden; es gilt die jeweils hier veröffentlichte Fassung. Es gilt österreichisches Recht.</P>
    </>
  );
}

function Cookies({ onCleared }: { onCleared: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <P>{SITE.name} setzt <strong>keine Cookies</strong>, weder eigene noch von Dritten.</P>
      <H>Was stattdessen auf deinem Gerät gespeichert wird</H>
      <P>Damit die Seite sich deine Eingaben merken kann, nutzt sie den lokalen Speicher deines Browsers. Diese Daten verlassen dein Gerät nicht.</P>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead><tr className="bg-surface2 text-left"><th scope="col" className="px-3 py-2 font-semibold">Name</th><th scope="col" className="px-3 py-2 font-semibold">Zweck</th></tr></thead>
          <tbody>{STORAGE_KEYS.map((k) => <tr key={k.key} className="border-t border-line"><td className="num px-3 py-2">{k.key}</td><td className="px-3 py-2">{k.purpose}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => { setMsg(clearLocalData() ? 'Alle gespeicherten Daten wurden gelöscht.' : 'Der Speicher konnte nicht gelöscht werden.'); onCleared(); }}>Alle gespeicherten Daten löschen</Button>
        {msg && <span role="status" className="text-[13px] text-muted">{msg}</span>}
      </div>
      <H>Besucherzählung</H>
      <P>Nur wenn du zustimmst, wird eine anonyme Besucherzählung geladen (Vercel Web Analytics). Sie arbeitet laut Anbieter ohne Cookies. Du kannst deine Entscheidung hier jederzeit ändern. Nach einer Ablehnung wird das Skript ab dem nächsten Laden der Seite nicht mehr geladen.</P>
      {ANALYTICS_AVAILABLE ? <div className="mt-3"><ConsentChoice /></div> : <P>In dieser Ansicht ist die Besucherzählung abgeschaltet.</P>}
    </>
  );
}

function Erstattung() {
  return (
    <>
      <P>{SITE.name} ist vollständig kostenlos. Es gibt keine Käufe, Abos, Bezahlfunktionen oder Spenden über diese Seite. Es werden keine Zahlungsdaten erhoben.</P>
      <H>Rückerstattung</H>
      <P>Da nichts bezahlt wird, gibt es nichts zu erstatten. Sollte es künftig kostenpflichtige Funktionen geben, werden hier vorher die Bedingungen für Rücktritt und Rückerstattung veröffentlicht, einschließlich des gesetzlichen Rücktrittsrechts für Verbraucherinnen und Verbraucher.</P>
      <H>Kreditangebote</H>
      <P>{SITE.name} vermittelt keine Kredite und erhält keine Provisionen. Fragen zu Zahlungen an eine Bank richtest du bitte direkt an diese Bank.</P>
    </>
  );
}

const TITLES: Record<LegalPage, string> = { datenschutz: 'Datenschutzerklärung', nutzung: 'Nutzungsbedingungen', cookies: 'Cookie-Richtlinie', erstattung: 'Rückerstattung' };

export function Legal({ page, onBack, onCleared }: { page: LegalPage; onBack: () => void; onCleared: () => void }) {
  return (
    <article className="mx-auto w-full max-w-[720px] rounded-card border border-line bg-surface p-5 text-[15px] sm:p-8">
      <Button onClick={onBack}>← Zurück zur Startseite</Button>
      <h2 className="mt-4 font-display text-[28px] font-bold leading-tight tracking-tight">{TITLES[page]}</h2>
      <p className="mt-1 text-[13px] text-muted">Stand: {SITE.legalDate}</p>
      {page === 'datenschutz' && <Datenschutz />}
      {page === 'nutzung' && <Nutzung />}
      {page === 'cookies' && <Cookies onCleared={onCleared} />}
      {page === 'erstattung' && <Erstattung />}
    </article>
  );
}

/** Fußzeilen-Links zu den Rechtsseiten. */
export function LegalLinks({ onOpen }: { onOpen: (p: LegalPage | 'quellen') => void }) {
  return (
    <nav aria-label="Rechtliches" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
      {[{ value: 'quellen' as const, label: 'Quellen und Annahmen' }, ...LEGAL_PAGES].map((p) => (
        <a key={p.value} href={`#${p.value}`} onClick={(e) => { e.preventDefault(); onOpen(p.value); }} className="font-medium text-muted underline underline-offset-2 hover:text-accent">{p.label}</a>
      ))}
    </nav>
  );
}
