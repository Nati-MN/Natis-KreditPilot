import { useState } from 'react';
import { euro } from '../lib/format';
import { loanAmount, saveScenarios, type AppState, type SavedScenario } from '../lib/state';
import { Button, Card } from './ui';

export function Scenarios({ state, list, setList, onLoad }: { state: AppState; list: SavedScenario[]; setList: (l: SavedScenario[]) => void; onLoad: (s: AppState) => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const store = (next: SavedScenario[], ok: string) => {
    setList(next);
    setNote(saveScenarios(next) ? ok : 'Dieser Browser erlaubt kein Speichern. Die Immobilie bleibt nur bis zum Schließen der Seite erhalten.');
  };
  const trimmed = name.trim();
  return (
    <Card title="Meine Immobilien">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          const entry: SavedScenario = { id: `${Date.now()}`, name: trimmed, savedAt: new Date().toISOString(), state };
          store([entry, ...list.filter((x) => x.name !== trimmed)], `„${trimmed}“ gespeichert.`);
          setName('');
        }}
      >
        <label htmlFor="szenario-name" className="sr-only">Name der Immobilie oder des Szenarios</label>
        <input id="szenario-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="z. B. Wohnung A, Graz"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent" />
        <Button type="submit" variant="primary" disabled={!trimmed}>Speichern</Button>
      </form>
      {note && <p role="status" className="mt-2 text-[13px] text-muted">{note}</p>}
      {list.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Speichere deine Eingaben unter einem Namen, um sie später zu laden oder mehrere Immobilien zu vergleichen. Gespeichert wird nur in diesem Browser.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {list.map((sc) => (
            <li key={sc.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{sc.name}</div>
                <div className="num text-[12px] text-muted">{euro(sc.state.price)} · Kredit {euro(loanAmount(sc.state))} · {new Date(sc.savedAt).toLocaleDateString('de-AT')}</div>
              </div>
              <Button onClick={() => { onLoad(sc.state); setNote(`„${sc.name}“ geladen.`); }}>Laden</Button>
              <button type="button" aria-label={`${sc.name} löschen`} onClick={() => store(list.filter((x) => x.id !== sc.id), `„${sc.name}“ gelöscht.`)}
                className="rounded-lg px-2 py-1 text-muted hover:text-bad">✕</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
