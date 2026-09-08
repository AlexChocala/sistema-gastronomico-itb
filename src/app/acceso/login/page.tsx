// Página que renderiza el formulario de login. La lógica vive en LoginForm
// (componente de cliente) porque necesita manejar estado e interacción.

import { LoginForm } from '@/components/forms/LoginForm'

export default function LoginPage() {
  return <LoginForm />
}
