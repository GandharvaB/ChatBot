import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Siri OS AI Avatar',
  description: 'A 3D AI Avatar Chatbot that behaves like Apple Siri',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
