import './globals.css'

export const metadata = {
  title: 'Steam Hours Tracker',
  description: 'Horas jogadas por dia, por jogo, na Steam',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
