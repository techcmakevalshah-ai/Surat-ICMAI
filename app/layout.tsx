import './styles.css'

export const metadata = {
  title: 'Student Registration Finder',
  description: 'Internal student registration lookup',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
