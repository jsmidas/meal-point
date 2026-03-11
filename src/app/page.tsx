import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import WhySection from "@/components/landing/WhySection";
import Products from "@/components/landing/Products";
import HeatingDemo from "@/components/landing/HeatingDemo";
import OrderProcess from "@/components/landing/OrderProcess";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";
import FloatingCTA from "@/components/landing/FloatingCTA";
import ParticleCanvas from "@/components/landing/ParticleCanvas";

export default function Home() {
  return (
    <div className="bg-bg-dark min-h-screen relative">
      <ParticleCanvas />
      <div className="relative z-10">
        <Header />
        <Hero />
        <WhySection />
        <Products />
        <HeatingDemo />
        <OrderProcess />
        <Contact />
        <Footer />
        <FloatingCTA />
      </div>
    </div>
  );
}
