import { useMemo, useState } from 'react';
import { analyze } from '../lib/analysis';
import { euro, percent, signedEuro } from '../lib/format';
import { balanceAtDate } from '../lib/loan';
import { saveScenarios, type AppState, type SavedScenario } from '../lib/state';
import { Button, Card, ResultCard } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

function metrics(state: AppState) {
  const a = analyze({ ...state, viewMode: 'erweitert', section: 'invest' });
  return {
    price: a.s.price,
    rent: a.month.income,
    payment: a.month.payment,
    cashflow: a.month.cashflow,
    // Restschuld zum heutigen Tag; vor Kreditbeginn ist das der volle Kreditbetrag.
    balance: balanceAtDate(a.loan, today(), a.fin.loan),
    netYield: a.yields.netOnTotal,
    location: a.s.invest.location,
    area: a.s.invest.livingArea,
  };
}

/** „Meine Immobilien“: alle gespeicherten Objekte mit Cashflow, Restschuld und Einnahmen auf einen Blick. */
export function Portfolio({ current, list, setList, onOpen, onNew }: {
  current: AppState; list: SavedScenario[]; setList: (l: SavedScenario[]) => void; onOpen: (s: AppState) => void; onNew: () => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const rows = useMemo(() => list.map((p) => ({ p, m: metrics(p.state) })), [list]);
  const now = useMemo(() => metrics(current), [current]);
  const sum = (f: (m: ReturnType<typeof metrics>) => number) => rows.reduce((s, r) => s + f(r.m), 0);
  const store = (next: SavedScenario[], ok: string) => {
    setList(next);
    setNote(saveScenarios(next) ? ok : 'Dieser Browser erlaubt kein Speichern. Die Daten bleiben nur bis zum Schließen der Seite erhalten.');
  };
  const trimmed = name.trim();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold leading-tight">Meine Immobilien</h2>
        <p className="mt-1 text-sm text-muted">Alle gespeicherten Objekte auf einen Blick. Ein Klick auf „Öffnen“ zeigt die Details im Rechner. Gespeichert wird nur in diesem Browser.</p>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResultCard label="Objekte" value={String(rows.length)} sub={`Kaufpreise zusammen ${euro(sum((m) => m.price))}`} />
          <div className={`flex min-w-0 flex-col justify-between gap-2 rounded-card p-4 text-surface ${sum((m) => m.cashflow) >= 0 ? 'bg-good' : 'bg-bad'}`}>
            <div className="text-[13px] font-medium opacity-90">Cashflow pro Monat gesamt</div>
            <div className="num font-display text-[26px] font-bold leading-none tracking-tight">{signedEuro(sum((m) => m.cashflow))}</div>
          </div>
          <ResultCard label="Mieteinnahmen pro Monat" value={euro(sum((m) => m.rent))} sub="Nettokaltmiete nach Leerstand" />
          <ResultCard tone="rest" label="Restschulden gesamt" value={euro(sum((m) => m.balance))} sub={`Kreditraten zusammen ${euro(sum((m) => m.payment))}`} />
        </div>
      )}

      {rows.length === 0 ? (
        <Card title="Noch keine Immobilie gespeichert">
          <p className="text-sm leading-relaxed text-muted">
            So legst du dein erstes Objekt an: Öffne „Immobilie vermieten“, trage Kaufpreis, Miete und Kosten ein und speichere es dann hier unter einem Namen. Danach erscheint es in dieser Übersicht.
          </p>
          <div className="mt-3"><Button variant="primary" onClick={onNew}>Erste Immobilie eingeben</Button></div>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ p, m }) => (
            <li key={p.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-bold leading-tight">{p.name}</h3>
                  <p className="num text-[13px] text-muted">{euro(m.price)} · {m.area} m²{m.location ? ` · ${m.location}` : ''}</p>
                </div>
                <span className={`num shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold text-surface ${m.cashflow >= 0 ? 'bg-good' : 'bg-bad'}`}>{signedEuro(m.cashflow)}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-[12px] text-muted">Cashflow pro Monat</dt><dd className={`num font-semibold ${m.cashflow >= 0 ? 'text-good' : 'text-bad'}`}>{signedEuro(m.cashflow)}</dd></div>
                <div><dt className="text-[12px] text-muted">Mieteinnahmen pro Monat</dt><dd className="num font-semibold">{euro(m.rent)}</dd></div>
                <div><dt className="text-[12px] text-muted">Restschuld heute</dt><dd className="num font-semibold">{euro(m.balance)}</dd></div>
                <div><dt className="text-[12px] text-muted">Kreditrate</dt><dd className="num font-semibold">{euro(m.payment)}</dd></div>
                <div><dt className="text-[12px] text-muted">Nettomietrendite</dt><dd className="num font-semibold">{percent(m.netYield, 2)}</dd></div>
                <div><dt className="text-[12px] text-muted">Gespeichert am</dt><dd className="num font-semibold">{new Date(p.savedAt).toLocaleDateString('de-AT')}</dd></div>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => onOpen(p.state)}>Öffnen</Button>
                {confirm === p.id ? (
                  <>
                    <Button onClick={() => { store(list.filter((x) => x.id !== p.id), `„${p.name}“ gelöscht.`); setConfirm(null); }}>Wirklich löschen</Button>
                    <Button onClick={() => setConfirm(null)}>Abbrechen</Button>
                  </>
                ) : (
                  <Button onClick={() => setConfirm(p.id)}>Löschen</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card title="Aktuelle Eingabe als Immobilie speichern">
        <p className="num mb-3 text-sm text-muted">
          Im Rechner steht gerade: Kaufpreis {euro(now.price)}, Mieteinnahmen {euro(now.rent)} pro Monat, Cashflow <span className={now.cashflow >= 0 ? 'font-semibold text-good' : 'font-semibold text-bad'}>{signedEuro(now.cashflow)}</span>.
        </p>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          const entry: SavedScenario = { id: `${Date.now()}${Math.round(Math.random() * 999)}`, name: trimmed, savedAt: new Date().toISOString(), state: current };
          store([entry, ...list.filter((x) => x.name !== trimmed)], `„${trimmed}“ gespeichert.`);
          setName('');
        }}>
          <label htmlFor="immobilie-name" className="sr-only">Name der Immobilie</label>
          <input id="immobilie-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="z. B. Wohnung Graz, Lend"
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent" />
          <Button type="submit" variant="primary" disabled={!trimmed}>Speichern</Button>
          <Button onClick={onNew}>Neue Immobilie eingeben</Button>
        </form>
        {note && <p role="status" className="mt-2 text-[13px] text-muted">{note}</p>}
      </Card>
      <p className="text-[13px] text-muted">Cashflow und Mieteinnahmen gelten für einen typischen Monat nach deinen Annahmen. Die Restschuld ist der Stand von heute laut Tilgungsplan.</p>
    </div>
  );
}
