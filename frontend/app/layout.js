import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'GoodSpot — Discover Restaurants You\'ll Actually Love',
  description: 'GoodSpot uses machine learning to recommend restaurants tailored to your taste. Content-based, collaborative filtering, and hybrid recommendations.',
  keywords: 'restaurant recommendation, Bangalore dining, food discovery, personalised restaurant',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
