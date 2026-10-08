import { useRef, useState } from 'react';
import { MIME, saveFile, toBlob } from '../lib/export';
import { euro } from '../lib/format';
import { exportScenarios, importScenarios, loanAmount, saveScenarios, type AppState, type SavedScenario } from '../lib/state';
import { Button, Card } from './ui';

/** Gespeicherte Berechnungen: speichern, laden, umbenennen, duplizieren, löschen, als Datei sichern und wieder einlesen. */
export function Scenarios({ state, list, setList, onLoad }: { state: AppState; list: SavedScenario[]; setList: (l: SavedScenario[]) => void; onLoad: (s: AppState) => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const store = (next: SavedScenario[], ok: string) => {
    setList(next);
    setNote(saveScenarios(next) ? ok : 'Dieser Browser erlaubt kein Speichern. Die Daten bleiben nur bis zum Schließen der Seite erhalten.');
  };
  const trimmed = name.trim();
  const id = () => `${Date.now()}${Math.round(Math.random() * 999)}`;
  const unique = (base: string) => {
    let n = base;
    let i = 2;
    while (list.some((x) => x.name === n)) n = `${base} (${i++})`;
    return n;
  };

  const doExport = async () => {
    const msg = await saveFile('kredit-pilot-szenarien.json', toBlob(exportScenarios(list, state), MIME.json));
    setNote(msg ?? null);
  };
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return setNote('Die Datei ist zu groß.');
    const data = importScenarios(await file.text());
    if (!data) return setNote('Die Datei ist keine gültige Kredit-Pilot-Sicherung.');
    const names = new Set(list.map((x) => x.name));
    const added = data.scenarios.map((sc) => ({ ...sc, id: id() + sc.id.slice(-4), name: names.has(sc.name) ? `${sc.name} (Import)` : sc.name }));
    // Die aktuellen Eingaben der Datei werden als eigenes Szenario abgelegt, damit nichts ungefragt überschrieben wird.
    const current = data.current ? [{ id: id(), name: unique('Stand der Datei'), savedAt: new Date().toISOString(), state: data.current }] : [];
    store([...current, ...added, ...list].slice(0, 100), `${added.length + current.length} Szenarien eingelesen. Mit „Laden“ übernimmst du eines davon.`);
  };

  return (
    <Card title="Meine Szenarien">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          const entry: SavedScenario = { id: id(), name: trimmed, savedAt: new Date().toISOString(), state };
          store([entry, ...list.filter((x) => x.name !== trimmed)], `„${trimmed}“ gespeichert.`);
          setName('');
        }}
      >
        <label htmlFor="szenario-name" className="sr-only">Name der Berechnung</label>
        <input id="szenario-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="z. B. Wohnung A, 25 Jahre"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent" />
        <Button type="submit" variant="primary" disabled={!trimmed}>Speichern</Button>
      </form>
      {note && <p role="status" className="mt-2 text-[13px] text-muted">{note}</p>}
      {list.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">Speichere deine Eingaben unter einem Namen, um sie später zu laden oder mehrere Finanzierungen zu vergleichen. Gespeichert wird nur in diesem Browser.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {list.map((sc) => (
            <li key={sc.id} className="py-2">
              {renaming === sc.id ? (
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  const n = newName.trim();
                  if (n) store(list.map((x) => (x.id === sc.id ? { ...x, name: n } : x)), `Umbenannt in „${n}“.`);
                  setRenaming(null);
                }}>
                  <input id={`umbenennen-${sc.id}`} aria-label="Neuer Name" autoFocus value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-accent" />
                  <Button type="submit" variant="primary">OK</Button>
                  <Button onClick={() => setRenaming(null)}>Abbrechen</Button>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{sc.name}</div>
                      <div className="num text-[12px] text-muted">{euro(sc.state.price)} · Kredit {euro(loanAmount(sc.state))} · {new Date(sc.savedAt).toLocaleDateString('de-AT')}</div>
                    </div>
                    <Button onClick={() => { onLoad(sc.state); setNote(`„${sc.name}“ geladen.`); }}>Laden</Button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[13px]">
                    <button type="button" className="text-muted underline-offset-2 hover:text-accent hover:underline" onClick={() => { setRenaming(sc.id); setNewName(sc.name); }}>Umbenennen</button>
                    <button type="button" className="text-muted underline-offset-2 hover:text-accent hover:underline" onClick={() => store([{ ...sc, id: id(), name: unique(`${sc.name} (Kopie)`), savedAt: new Date().toISOString() }, ...list], `„${sc.name}“ dupliziert.`)}>Duplizieren</button>
                    <button type="button" className="text-muted underline-offset-2 hover:text-accent hover:underline" onClick={() => store(list.map((x) => (x.id === sc.id ? { ...x, state, savedAt: new Date().toISOString() } : x)), `„${sc.name}“ mit den aktuellen Eingaben überschrieben.`)}>Überschreiben</button>
                    <button type="button" className="text-muted underline-offset-2 hover:text-bad hover:underline" onClick={() => store(list.filter((x) => x.id !== sc.id), `„${sc.name}“ gelöscht.`)}>Löschen</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button onClick={doExport}>Als Datei sichern</Button>
        <Button onClick={() => fileRef.current?.click()}>Aus Datei einlesen</Button>
        <input ref={fileRef} id="szenario-import" type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Sicherungsdatei auswählen"
          onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="mt-2 text-[13px] text-muted">Die Sicherungsdatei enthält deine Finanzdaten. Sie bleibt auf deinem Gerät und wird nirgends hochgeladen. Teilbare Links gibt es bewusst nicht, damit keine Finanzdaten in Adressen oder Verläufen landen.</p>
    </Card>
  );
}
