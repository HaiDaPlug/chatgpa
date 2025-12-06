import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FirstSession } from '@/components/landing/FirstSession';
import { WhyItMatters } from '@/components/landing/WhyItMatters';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <FirstSession />
        <WhyItMatters />
        <ProductPreview />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
