import { ARTICLES, ARTICLES_DATE, findArticle, type Article } from '../lib/articles';
import { Link } from './Link';
import { Button } from './ui';

const linkClass = 'font-medium text-accent underline underline-offset-2';

function ArticleView({ article, onCta }: { article: Article; onCta: (a: Article) => void }) {
  return (
    <article className="mx-auto w-full max-w-[720px] rounded-card border border-line bg-surface p-5 text-[15px] sm:p-8">
      <nav aria-label="Brotkrumen" className="text-[13px] text-muted">
        <Link to="start" className={linkClass}>Start</Link> › <Link to="ratgeber" className={linkClass}>Ratgeber</Link>
      </nav>
      <h2 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight">{article.title}</h2>
      <p className="mt-1 text-[13px] text-muted">Stand: {ARTICLES_DATE}</p>
      <p className="mt-4 text-[17px] leading-relaxed">{article.lead}</p>

      <div className="mt-5 rounded-xl bg-accentsoft p-4">
        <h3 className="text-sm font-semibold">Kurz gesagt</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">{article.summary.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>

      {article.sections.map((s) => (
        <section key={s.heading}>
          <h3 className="mt-6 font-display text-lg font-bold leading-tight">{s.heading}</h3>
          {s.paragraphs?.map((p) => <p key={p} className="mt-2 leading-relaxed">{p}</p>)}
          {s.list && <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{s.list.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>
      ))}

      <div className="mt-7 flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
        <p className="min-w-0 flex-1 basis-[220px] font-medium">Rechne es mit deinen eigenen Zahlen nach.</p>
        <Button variant="primary" onClick={() => onCta(article)}>{article.cta.label} →</Button>
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        Die Zinssätze in den Beispielen sind frei gewählt und keine aktuellen Marktwerte. Gebühren und Steuersätze: Österreich, Stand {ARTICLES_DATE}. Der Text ist eine allgemeine Erklärung und keine Beratung.{' '}
        <Link to="quellen" className={linkClass}>Quellen ansehen</Link>
      </p>

      <h3 className="mt-6 font-display text-lg font-bold leading-tight">Weitere Themen</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
        {ARTICLES.filter((a) => a.slug !== article.slug).map((a) => <li key={a.slug}><Link to="ratgeber" slug={a.slug} className={linkClass}>{a.title}</Link></li>)}
      </ul>
    </article>
  );
}

/** Ratgeber: Übersicht oder ein einzelner Text. */
export function Ratgeber({ slug, onCta }: { slug: string | null; onCta: (a: Article) => void }) {
  const article = slug ? findArticle(slug) : undefined;
  if (article) return <ArticleView article={article} onCta={onCta} />;
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <nav aria-label="Brotkrumen" className="text-[13px] text-muted"><Link to="start" className={linkClass}>Start</Link> › Ratgeber</nav>
      <h2 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight">Ratgeber</h2>
      <p className="mt-1 leading-relaxed text-muted">Kurz erklärt, jeweils mit Rechenbeispiel und Link zum passenden Rechner.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link to="ratgeber" slug={a.slug} className="block rounded-card border border-line bg-surface px-5 py-4 transition-colors hover:border-accent">
              <span className="block font-display text-lg font-bold leading-tight">{a.title}</span>
              <span className="mt-1 block text-sm text-muted">{a.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
