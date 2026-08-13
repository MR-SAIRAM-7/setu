import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Leaf, Shield, Zap, Globe, Code2, Users, Heart, Award } from 'lucide-react';

const About = () => {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const PillarCard = ({ icon: Icon, title, desc, delay }) => (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, delay }}
      className="glass-card p-8 text-center flex flex-col items-center hover:shadow-elevated transition-shadow"
    >
      <div className="w-20 h-20 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-600 mb-6 shadow-soft">
        <Icon size={40} />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{desc}</p>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-sage-50/50 -z-10"></div>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage-100 text-sage-800 font-medium mb-8">
              <Award size={18} />
              Built for Capgemini Hack4Positive 2026
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight">
              The <span className="text-sage-600">SETU</span> Vision
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-light max-w-3xl mx-auto">
              Bridging the cognitive gap. We are building a sanctuary for the neurodivergent mind in an overwhelming digital world.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Problem & Metaphor */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-16 items-center"
        >
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-gray-900">The Invisible Barrier</h2>
            <p className="text-lg text-gray-600">
              <strong className="text-gray-900">1.5 billion people</strong> worldwide face cognitive barriers online. For users with ADHD, Dyslexia, and Autism, the modern web is often a chaotic, overwhelming landscape of sensory overload and dense information.
            </p>
            <p className="text-lg text-gray-600">
              In Sanskrit, <span className="italic text-sage-700 font-semibold">SETU</span> means <strong>"Bridge"</strong>. Our mission is to build that bridge—connecting brilliant minds to the knowledge they seek, without the cognitive friction.
            </p>
          </div>
          <div className="glass-card p-10 bg-gradient-to-br from-sage-50 to-white relative overflow-hidden">
            <Globe className="text-sage-200 absolute -bottom-10 -right-10 w-64 h-64 opacity-50" />
            <h3 className="text-xl font-bold text-gray-800 mb-4 relative z-10">Designing for Cognitive Ease</h3>
            <ul className="space-y-4 relative z-10">
              {[
                { i: Leaf, t: 'Sensory Harmony', d: 'Muted palettes, calm motion' },
                { i: Zap, t: 'Cognitive Offloading', d: 'AI handles the heavy lifting' },
                { i: Heart, t: 'Empathic AI', d: 'Understands your state of mind' }
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-600">
                    <item.i size={20} />
                  </div>
                  <div>
                    <span className="font-semibold block text-gray-800">{item.t}</span>
                    <span className="text-sm text-gray-500">{item.d}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>

      {/* The Pillars */}
      <section className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">The Three Pillars</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">A holistic ecosystem designed to support you wherever you go.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <PillarCard 
              icon={Globe} 
              title="SETU Lens" 
              desc="A browser extension that acts as your protective shield, modifying the chaotic web in real-time before it reaches your eyes."
              delay={0.1}
            />
            <PillarCard 
              icon={Shield} 
              title="SETU Sanctuary" 
              desc="This web application. A focused, calm environment where you can organize thoughts, read deeply, and process information."
              delay={0.3}
            />
            <PillarCard 
              icon={Zap} 
              title="SETU Go" 
              desc="A companion mobile experience providing real-time cognitive assistance and task breakdown on the move."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Technology & Privacy */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="glass-card bg-gray-900 text-white p-12 md:p-16 rounded-3xl relative overflow-hidden">
          <Code2 className="absolute top-0 right-0 text-gray-800 w-96 h-96 -mr-20 -mt-20 opacity-20 pointer-events-none" />
          
          <div className="max-w-2xl relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Powered by Empathy & Innovation</h2>
            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              We believe accessibility requires uncompromising privacy. SETU uses a layered architecture to protect your data while delivering powerful AI assistance.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h4 className="font-bold text-sage-400 mb-2 flex items-center gap-2"><Shield size={18}/> L0 Local AI</h4>
                <p className="text-sm text-gray-400">WASM-powered on-device models that process sensitive text without it ever leaving your machine.</p>
              </div>
              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h4 className="font-bold text-sage-400 mb-2 flex items-center gap-2"><Globe size={18}/> Zero-Knowledge</h4>
                <p className="text-sm text-gray-400">When L2 Cloud AI is needed, we strip personally identifiable information before it hits the wire.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">The Team Behind SETU</h2>
        <div className="flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-sage-200 rounded-full flex items-center justify-center text-sage-700 mb-4 shadow-medium">
            <Users size={40} />
          </div>
          <h4 className="text-xl font-bold text-gray-800">SETU Team</h4>
          <p className="text-sage-600 font-medium">Hack4Positive 2026 Innovators</p>
          <p className="text-gray-500 mt-4 max-w-lg">
            A passionate group of developers and designers committed to building a more inclusive digital future.
          </p>
        </div>
      </section>
    </div>
  );
};

export default About;
