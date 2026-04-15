// Barrel-реэкспорты shared UI. Новый код должен импортировать отсюда;
// плоская директория `components/ui/` остаётся для бэкомпата и будет удалена
// после миграции всех пользователей.
export { default as Button } from '../../components/ui/Button.jsx'
export { default as Input } from '../../components/ui/Input.jsx'
export { default as Spinner } from '../../components/ui/Spinner.jsx'
export { default as FileUpload } from '../../components/ui/FileUpload.jsx'
export { default as ParticleBackground } from '../../components/ui/ParticleBackground.jsx'
export { default as TopProgressBar } from '../../components/ui/TopProgressBar.jsx'
export { ToastProvider, useToast } from '../../components/ui/Toast.jsx'
export { Modal, ConfirmDialog } from '../../components/ui/Modal.jsx'
export { default as Card } from '../../components/ui/Card.jsx'
export { default as Badge } from '../../components/ui/Badge.jsx'
export { default as Textarea } from '../../components/ui/Textarea.jsx'
export { default as Select } from '../../components/ui/Select.jsx'
