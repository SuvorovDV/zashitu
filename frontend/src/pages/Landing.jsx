import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '../api/index.js'
import { useAuth } from '../hooks/index.js'
import Spinner from '../components/ui/Spinner.jsx'

const STEPS = [
  {
    num: '01',
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    title: 'Загрузи работу',
    desc: 'PDF или DOCX — дипломная, курсовая, реферат. До\u00a020\u00a0МБ.',
  },
  {
    num: '02',
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
    title: 'ИИ анализирует',
    desc: 'ИИ читает текст, выделяет ключевые тезисы и строит структуру.',
  },
  {
    num: '03',
    icon: (
      <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Скачай .pptx',
    desc: 'Открывается в PowerPoint, Keynote, Google Slides. Редактируй.',
  },
]

const FEATURES = [
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Без галлюцинаций',
    desc: 'Каждый тезис берётся из вашего текста — ИИ не придумывает.',
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Ссылки на страницы',
    desc: 'Научрук проверит — каждый факт с номером страницы источника.',
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    title: 'Профессиональный дизайн',
    desc: '10 цветовых палитр, современные макеты для любой темы.',
  },
  {
    icon: (
      <svg aria-hidden="true" className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Быстро',
    desc: 'Презентация готова за 1–2\u00a0минуты после оплаты.',
  },
]

const TIER_BADGE = { basic: null, standard: 'Популярный', premium: 'Максимум' }

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['tiers'],
    queryFn: () => paymentsApi.getTiers().then((r) => r.data),
    staleTime: 60_000,
  })

  const ctaHref = user ? '/wizard' : '/register'

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[92vh] flex flex-col items-center justify-center px-5 py-28">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand-500/30 bg-brand-600/10 text-brand-300 text-xs font-semibold mb-8">
            Презентация и текст выступления
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.06]"
            style={{ textWrap: 'balance' }}
          >
            Защита диплома<br />
            <span className="text-white">без бессонных ночей</span>
          </h1>

          <p className="text-[#B8AE97] text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ textWrap: 'pretty' }}>
            <strong className="text-white">Tezis</strong> — сервис, который на основе вашей работы
            делает презентацию и текст выступления. Каждый тезис подкреплён
            ссылкой на страницу источника.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={ctaHref}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0E0B]"
            >
              Создать презентацию
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center px-7 py-3.5 rounded-xl bg-[#1A1712] hover:bg-[#221E17] text-[#B8AE97] hover:text-white font-medium text-base transition-colors duration-200 border border-[#2E2820] hover:border-[#4A402F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Как это работает
            </a>
          </div>

          <p className="mt-8 text-[#7A7362] text-sm">
            PDF и DOCX&nbsp;·&nbsp;Скачивание в формате&nbsp;.pptx
          </p>
        </div>
      </section>

      {/* ── Два режима ───────────────────────────────────────────────────── */}
      <section id="modes" className="py-24 px-5 border-t border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-brand-400 text-xs font-bold uppercase tracking-[0.18em] mb-3">Два формата</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ textWrap: 'balance' }}>
              Выберите, что вам нужно
            </h2>
            <p className="text-[#B8AE97] mt-4 max-w-xl mx-auto text-[15px]" style={{ textWrap: 'pretty' }}>
              Нужна только презентация — сделаем её. Нужно ещё и что говорить со сцены —
              напишем текст выступления и синхронизируем со слайдами.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Mode 1: только презентация */}
            <div className="card rounded-2xl p-7 flex flex-col gap-4 hover:bg-[#221E17] hover:border-[#4A402F] transition-colors duration-200">
              <div className="w-11 h-11 rounded-xl bg-brand-600/15 border border-brand-500/25 flex items-center justify-center text-brand-400">
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1.5">Только презентация</h3>
                <p className="text-[#B8AE97] text-sm leading-relaxed">
                  Загружаете .pdf/.docx — получаете .pptx. 12–30 слайдов, 10 палитр,
                  ссылки на страницы вашей работы.
                </p>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-[#B8AE97] mt-auto pt-4 border-t border-[#2E2820]">
                {['Готовые макеты', 'Формат .pptx', 'Редактируется в PowerPoint / Keynote'].map((i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {i}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mode 2: презентация + текст выступления */}
            <div className="relative rounded-2xl p-7 flex flex-col gap-4 bg-brand-600/12 border-2 border-brand-500/50">
              <div className="absolute -top-3.5 left-6 px-3 py-1 bg-brand-500 text-[#0F0E0B] text-[11px] font-bold rounded-full shadow-lg shadow-brand-900/50 tracking-wide">
                НОВИНКА
              </div>
              <div className="w-11 h-11 rounded-xl bg-brand-500 text-[#0F0E0B] flex items-center justify-center">
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8m-8-14a4 4 0 118 0v6a4 4 0 11-8 0V5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-1.5">Презентация + текст выступления</h3>
                <p className="text-[#B8AE97] text-sm leading-relaxed">
                  К слайдам добавим полный сценарий защиты на 5–15 минут:
                  вступление, основная часть, заключение. В Markdown — удобно репетировать.
                </p>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-[#B8AE97] mt-auto pt-4 border-t border-brand-500/25">
                {[
                  'Всё из первого режима',
                  'Markdown-текст на 5–15 минут',
                  'Структура «Вступление → Основная часть → Заключение»',
                  'Скачивание .md + копирование',
                ].map((i) => (
                  <li key={i} className="flex items-center gap-2">
                    <svg aria-hidden="true" className="w-3.5 h-3.5 text-brand-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Как это работает ─────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-5 border-t border-[#2E2820]" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-bold uppercase tracking-[0.18em] mb-3">Процесс</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ textWrap: 'balance' }}
            >
              Три шага до готовой презентации
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map(({ num, icon, title, desc }) => (
              <div
                key={num}
                className="card rounded-2xl p-7 hover:bg-[#221E17] hover:border-[#4A402F] transition-colors duration-200 group"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/15 border border-brand-500/25 flex items-center justify-center text-brand-400 group-hover:bg-brand-600/25 transition-colors duration-200">
                    {icon}
                  </div>
                  <span
                    aria-hidden="true"
                    className="text-5xl font-bold text-white/5 select-none"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {num}
                  </span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-[#B8AE97] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Преимущества ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-bold uppercase tracking-[0.18em] mb-3">Преимущества</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ textWrap: 'balance' }}
            >
              Чем отличаемся от Gamma
            </h2>
            <p className="text-[#B8AE97] mt-4 max-w-lg mx-auto text-[15px]" style={{ textWrap: 'pretty' }}>
              Gamma придумывает содержание слайдов. Мы берём его только из вашей работы.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="card rounded-2xl p-6 flex gap-4 hover:bg-[#221E17] hover:border-[#4A402F] transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-600/15 border border-brand-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {icon}
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1.5">{title}</h3>
                  <p className="text-[#B8AE97] text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Тарифы ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-[#2E2820]" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-xs font-bold uppercase tracking-[0.18em] mb-3">Тарифы</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ textWrap: 'balance' }}
            >
              Выберите объём
            </h2>
            <p className="text-[#B8AE97] mt-4 text-[15px]">Оплата единоразово за каждую презентацию</p>
          </div>

          {tiersLoading ? (
            <div className="flex justify-center py-10" aria-label="Загрузка тарифов…">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5 items-start">
              {tiers && Object.values(tiers).map((tier) => {
                const badge = TIER_BADGE[tier.id]
                const isPopular = tier.id === 'standard'
                return (
                  <div
                    key={tier.id}
                    className={`relative rounded-2xl p-7 flex flex-col gap-5 transition-colors duration-200 ${
                      isPopular
                        ? 'bg-brand-600/12 border-2 border-brand-500/50'
                        : 'card hover:bg-[#221E17] hover:border-[#4A402F]'
                    }`}
                  >
                    {badge && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-brand-600 text-white text-[11px] font-bold rounded-full shadow-lg shadow-brand-900/50 whitespace-nowrap">
                        {badge}
                      </div>
                    )}

                    <div>
                      <p className="text-[#B8AE97] text-sm font-medium mb-2">{tier.label}</p>
                      <div
                        className="flex items-baseline gap-1 text-white"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        <span className="text-4xl font-bold">
                          {new Intl.NumberFormat('ru-RU').format(tier.price_rub)}
                        </span>
                        <span className="text-2xl text-[#7A7362]">₽</span>
                      </div>
                    </div>

                    <ul className="flex flex-col gap-3 text-sm text-[#B8AE97]">
                      {[
                        `${tier.slides}\u00a0слайдов`,
                        tier.id === 'premium' ? 'Premium-модель' : 'Стандартная модель',
                        'Ссылки на страницы',
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2.5">
                          <svg aria-hidden="true" className="w-4 h-4 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={ctaHref}
                      className={`mt-auto inline-block text-center w-full py-2.5 rounded-xl font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        isPopular
                          ? 'bg-brand-500 hover:bg-brand-400 text-[#0F0E0B]'
                          : 'border border-brand-500/60 text-brand-300 hover:bg-brand-500 hover:text-[#0F0E0B] hover:border-brand-500'
                      }`}
                    >
                      Выбрать
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-28 px-5 relative overflow-hidden border-t border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="relative z-10 max-w-xl mx-auto text-center">
          <h2
            className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Попробуй прямо сейчас
          </h2>
          <p className="text-[#B8AE97] text-lg mb-8" style={{ textWrap: 'pretty' }}>
            Регистрация за 30 секунд. Первая презентация через пару минут.
          </p>
          <Link
            to={ctaHref}
            className="inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17140F]"
          >
            Начать бесплатно
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-8 px-5 border-t border-[#2E2820]" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs">T</div>
            <span className="text-[#B8AE97] text-sm font-medium">Tezis</span>
          </div>
          <p className="text-[#7A7362] text-xs">
            Презентации и тексты выступлений по академическим работам
          </p>
        </div>
      </footer>
    </div>
  )
}
