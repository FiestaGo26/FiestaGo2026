'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CITIES, getPhoto } from '@/lib/constants'
import { precioCliente, formatEuro, textoGarantiaIncluida } from '@/lib/pricing'
import { toggleFavorite, useIsFavorite } from '@/lib/favorites'
import {
  EVENT_OPTIONS, AUDIENCE_OPTIONS, KIDS_AGE_OPTIONS, CORP_OPTIONS, getProfile, needsDetail,
  type EventType, type Audience, type KidsAge, type CorpKind,
} from '@/lib/quiz'
import toast from 'react-hot-toast'
import '../home.css'
import './quiz.css'
import { getAcquisition } from '@/lib/attribution'

type Step = 'evento' | 'detalle' | 'invitados' | 'ciudad' | 'estilo' | 'presupuesto' | 'email'

const catLabel = (id: string) => (CATEGORIES.find((c: any) => c.id === id)?.label || id)

function FavBtn({ id, name }: { id: string; name: string }) {
  const fav = useIsFavorite(id)
  return (
    <button type="button" aria-pressed={fav} aria-label={`${fav ? 'Quitar' : 'Guardar'} ${name} de favoritos`}
      className="qz-fav"
      onClick={(e) => {
        e.preventDefault()
        const next = toggleFavorite(id)
        toast.success(next ? 'Guardado en favoritos' : 'Quitado de favoritos')
      }}>
      <svg width="20" height="18" viewBox="0 0 24 22" aria-hidden="true">
        <path d="M12 20.5S2 14.3 2 7.6A5.1 5.1 0 0 1 12 5a5.1 5.1 0 0 1 10 2.6c0 6.7-10 12.9-10 12.9Z"
          fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function Choice({ selected, label, hint, onClick }: { selected: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" className="qz-choice" aria-pressed={selected} onClick={onClick}>
      <strong>{label}</strong>
      {hint && <span>{hint}</span>}
    </button>
  )
}

export default function QuizPage() {
  const [step, setStep]           = useState<Step>('evento')
  const [eventType, setEventType] = useState<EventType>('boda')
  const [audience, setAudience]   = useState<Audience | ''>('')
  const [kidsAge, setKidsAge]     = useState<KidsAge | ''>('')
  const [corpKind, setCorpKind]   = useState<CorpKind | ''>('')
  const [guests, setGuests]       = useState(100)
  const [city, setCity]           = useState('')
  const [vibe, setVibe]           = useState('')
  const [budget, setBudget]       = useState(15000)
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<any>(null)

  const profile = getProfile(eventType, { audience, age: kidsAge, corp: corpKind })
  const steps: Step[] = ['evento', ...(needsDetail(eventType) ? ['detalle' as Step] : []), 'invitados', 'ciudad', 'estilo', 'presupuesto', 'email']
  const stepIdx = steps.indexOf(step)
  const progress = ((stepIdx + 1) / steps.length) * 100

  // Al cambiar el perfil, los valores por defecto pasan a ser los suyos
  function applyDefaults(e: EventType, a: Audience | '', age: KidsAge | '', c: CorpKind | '') {
    const p = getProfile(e, { audience: a, age, corp: c })
    setGuests(p.guests)
    setBudget(p.budget.initial)
    setVibe('')
  }

  const go = (s: Step) => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const next = () => { if (stepIdx < steps.length - 1) go(steps[stepIdx + 1]) }
  const prev = () => { if (stepIdx > 0) go(steps[stepIdx - 1]) }

  const detailDone = eventType === 'cumpleanos'
    ? audience !== '' && (audience !== 'ninos' || kidsAge !== '')
    : eventType === 'corporativo' ? corpKind !== '' : true

  function pickEvent(e: EventType) {
    setEventType(e); setAudience(''); setKidsAge(''); setCorpKind('')
    applyDefaults(e, '', '', '')
    go(needsDetail(e) ? 'detalle' : 'invitados')
  }

  async function submit() {
    setLoading(true)
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType, audience, kids_age: kidsAge, corp_kind: corpKind,
          guests, city, vibe, budget_total: budget,
          email: email || undefined,
          acquisition: getAcquisition(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Algo salió mal')
      } else {
        setResult(data)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch {
      toast.error('Sin conexión')
    }
    setLoading(false)
  }

  function handleShare() {
    const url = window.location.href.split('?')[0]
    if (navigator.share) {
      navigator.share({ title: 'Mis proveedores en FiestaGo', text: `Estoy preparando un ${profile.title}. Mira lo que me recomienda FiestaGo:`, url }).catch(() => {})
      return
    }
    navigator.clipboard.writeText(url).then(() => toast.success('Enlace copiado'))
  }

  // ── RESULTADO ─────────────────────────────────────────────────────
  if (result) {
    const found = result.categories.filter((c: string) => result.matchesByCategory[c]?.length > 0)
    const missing = result.categories.filter((c: string) => !result.matchesByCategory[c]?.length)
    return (
      <main className="fg qz">
        <section className="qz-result-head">
          <h1>Tus proveedores</h1>
          <p className="lead">
            Para tu {result.title}, {result.guests} invitados{result.city ? ` en ${result.city}` : ''} y {formatEuro(result.budgetTotal, { showCents: 'never' })} de presupuesto.
          </p>
          <div className="qz-result-actions">
            <button type="button" className="fg-btn fg-btn--ink" onClick={handleShare}>Compartir</button>
            <Link href="/favoritos" className="fg-link">Ver mis favoritos</Link>
            <button type="button" className="fg-link qz-linkbtn" onClick={() => { setResult(null); go('evento') }}>Rehacer el quiz</button>
          </div>
        </section>

        <section className="qz-results">
          {found.map((catId: string) => (
            <div key={catId} className="qz-cat">
              <div className="qz-cat__head">
                <h2>{catLabel(catId)}</h2>
                <p>Reparto orientativo: <b className="num">{formatEuro(result.budgetSplit[catId], { showCents: 'never' })}</b></p>
              </div>
              <div className="qz-cards">
                {result.matchesByCategory[catId].map((p: any) => (
                  <Link key={p.id} href={`/proveedores/${p.slug || p.id}`} className="qz-card">
                    <div className="qz-card__img">
                      <img src={p.photo_url || getPhoto(p.category, p.photo_idx || 0, 600, 450)} alt={`${p.name}, ${catLabel(p.category).toLowerCase()} en ${p.city}`} loading="lazy" />
                    </div>
                    <div className="qz-card__body">
                      <div>
                        <strong>{String(p.name).trim()}</strong>
                        <span>{p.city}{p.rating > 0 ? ` · ★ ${Number(p.rating).toFixed(1)}` : ''}{p.verified ? ' · verificado' : ''}</span>
                        <span title={p.price_base ? textoGarantiaIncluida(p.price_base) : undefined}>
                          {p.price_base ? <>desde <b className="num">{formatEuro(precioCliente(p.price_base), { showCents: 'never' })}</b></> : 'Precio a consultar'}
                        </span>
                      </div>
                      <FavBtn id={p.id} name={p.name} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {missing.length > 0 && (
            <div className="qz-missing">
              <h2>Aún sin proveedores{result.city ? ` en ${result.city}` : ''}</h2>
              <p>Todavía no tenemos estas categorías para tu búsqueda. Cada semana se suman profesionales nuevos.</p>
              <ul>
                {missing.map((c: string) => (
                  <li key={c}>
                    <Link href={`/proveedores?categoria=${c}`} className="qz-missing__item">
                      <span>{catLabel(c)}</span>
                      <span className="num">{formatEuro(result.budgetSplit[c], { showCents: 'never' })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {found.length === 0 && (
            <p className="qz-empty">
              No hemos encontrado proveedores con precio para esta búsqueda.{' '}
              <Link href="/proveedores" className="fg-link">Ver todos los proveedores</Link>
            </p>
          )}
        </section>
      </main>
    )
  }

  // ── QUIZ ──────────────────────────────────────────────────────────
  return (
    <main className="fg qz">
      <section className="qz-sheet">
        <div className="qz-top">
          <span className="small">Pregunta {stepIdx + 1} de {steps.length}</span>
          <div className="qz-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        </div>

        {step === 'evento' && (
          <div className="qz-step">
            <h1>¿Qué celebras?</h1>
            <p>Te recomendamos proveedores según el tipo de celebración, tu ciudad y tu presupuesto.</p>
            <div className="qz-grid">
              {EVENT_OPTIONS.map(o => (
                <Choice key={o.id} selected={eventType === o.id} label={o.label} hint={o.hint} onClick={() => pickEvent(o.id)} />
              ))}
            </div>
          </div>
        )}

        {step === 'detalle' && eventType === 'cumpleanos' && (
          <div className="qz-step">
            <h1>¿Para quién es?</h1>
            <p>No se organiza igual un cumpleaños de 5 años que uno de 40.</p>
            <div className="qz-grid qz-grid--3">
              {AUDIENCE_OPTIONS.map(o => (
                <Choice key={o.id} selected={audience === o.id} label={o.label} hint={o.hint}
                  onClick={() => {
                    setAudience(o.id); setKidsAge('')
                    applyDefaults('cumpleanos', o.id, '', '')
                    if (o.id !== 'ninos') go('invitados')
                  }} />
              ))}
            </div>
            {audience === 'ninos' && (
              <div className="qz-sub">
                <h2>¿Cuántos años cumple?</h2>
                <div className="qz-chips">
                  {KIDS_AGE_OPTIONS.map(o => (
                    <button key={o.id} type="button" className="fg-filter" aria-pressed={kidsAge === o.id}
                      onClick={() => { setKidsAge(o.id); go('invitados') }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'detalle' && eventType === 'corporativo' && (
          <div className="qz-step">
            <h1>¿Qué tipo de evento?</h1>
            <p>Así sabemos si pesa más el espacio, el catering o la actividad.</p>
            <div className="qz-grid">
              {CORP_OPTIONS.map(o => (
                <Choice key={o.id} selected={corpKind === o.id} label={o.label} hint={o.hint}
                  onClick={() => { setCorpKind(o.id); applyDefaults('corporativo', '', '', o.id); go('invitados') }} />
              ))}
            </div>
          </div>
        )}

        {step === 'invitados' && (
          <div className="qz-step">
            <h1>¿Cuántos invitados?</h1>
            <p>Una cifra aproximada es suficiente.</p>
            <label className="qz-number">
              <input type="number" inputMode="numeric" min={1} max={1500} value={guests}
                onChange={e => setGuests(Math.max(1, parseInt(e.target.value) || 1))} />
              <span>personas</span>
            </label>
            <div className="qz-chips">
              {profile.guestPresets.map(n => (
                <button key={n} type="button" className="fg-filter" aria-pressed={guests === n} onClick={() => setGuests(n)}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {step === 'ciudad' && (
          <div className="qz-step">
            <h1>¿En qué ciudad?</h1>
            <p>Si ya sabes dónde, ajustamos las recomendaciones a profesionales de la zona.</p>
            <select className="qz-select" value={city} onChange={e => setCity(e.target.value)} aria-label="Ciudad">
              <option value="">Toda España / aún no lo sé</option>
              {CITIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {step === 'estilo' && (
          <div className="qz-step">
            <h1>¿Qué estilo te imaginas?</h1>
            <p>Elige el que más se acerque. Puedes saltarte esta pregunta.</p>
            <div className="qz-grid">
              {profile.styles.map(o => (
                <Choice key={o.id} selected={vibe === o.id} label={o.label} hint={o.hint} onClick={() => setVibe(vibe === o.id ? '' : o.id)} />
              ))}
            </div>
          </div>
        )}

        {step === 'presupuesto' && (
          <div className="qz-step">
            <h1>¿Cuál es tu presupuesto?</h1>
            <p>El total aproximado para tu {profile.title}. Lo repartimos entre las categorías que más pesan.</p>
            <output className="qz-budget num" htmlFor="qz-range">{formatEuro(budget, { showCents: 'never' })}</output>
            <input id="qz-range" type="range" className="qz-range"
              min={profile.budget.min} max={profile.budget.max} step={profile.budget.step}
              value={Math.min(Math.max(budget, profile.budget.min), profile.budget.max)}
              onChange={e => setBudget(parseInt(e.target.value))} aria-label="Presupuesto total" />
            <div className="qz-range-ends small num">
              <span>{formatEuro(profile.budget.min, { showCents: 'never' })}</span>
              <span>{formatEuro(profile.budget.max, { showCents: 'never' })} o más</span>
            </div>
          </div>
        )}

        {step === 'email' && (
          <div className="qz-step">
            <h1>¿Te avisamos de novedades?</h1>
            <p>Opcional. Si nos dejas tu email, te escribimos cuando lleguen proveedores nuevos que encajen con tu {profile.title}.</p>
            <input type="email" className="qz-select" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" aria-label="Email (opcional)" autoComplete="email" />
            <p className="small qz-note">Sin spam. Puedes darte de baja cuando quieras.</p>
          </div>
        )}

        <div className="qz-nav">
          {stepIdx > 0 && <button type="button" className="fg-cell qz-back" onClick={prev}>Atrás</button>}
          {step === 'email' ? (
            <button type="button" className="fg-btn qz-next" onClick={submit} disabled={loading}>
              {loading ? 'Buscando…' : 'Ver mis proveedores'}
            </button>
          ) : step !== 'evento' && (
            <button type="button" className="fg-btn qz-next" onClick={next} disabled={step === 'detalle' && !detailDone}>
              Siguiente
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
