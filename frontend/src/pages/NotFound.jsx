import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-5 px-4 text-center relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] rounded-full bg-brand-800/20 blur-[80px] pointer-events-none" />
      <p className="text-8xl font-bold text-white/8 tracking-tight">404</p>
      <div className="relative">
        <p className="text-xl font-semibold text-white">Страница не найдена</p>
        <p className="text-gray-500 text-sm mt-1">Возможно, вы перешли по неверной ссылке</p>
      </div>
      <button
        onClick={() => navigate('/')}
        className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all"
      >
        На главную
      </button>
    </div>
  )
}
