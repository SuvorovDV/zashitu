import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import TopProgressBar from './components/ui/TopProgressBar.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Wizard from './pages/Wizard.jsx'
import Payment from './pages/Payment.jsx'
import Generation from './pages/Generation.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <div className="min-h-screen flex flex-col bg-[#0F0E0B]">
            <TopProgressBar />
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/wizard" element={<Wizard />} />
                  <Route path="/payment" element={<Payment />} />
                  <Route path="/generation" element={<Generation />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
