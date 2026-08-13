import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowRight, Play, BookOpen, Brain, Focus, Eye, Sparkles, 
  MessageSquare, Edit3, ListTodo, Users, Layout, Settings2, Wind, Shield, CheckCircle
} from 'lucide-react';

const FadeIn = ({ children, delay = 0, direction = 'up' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const directions = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directions[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

export default function Landing() {
  const navigate = useNavigate();

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  const stats = [
    { label: "Affected Worldwide", value: "1.5B+" },
    { label: "Websites Inaccessible", value: "70%" },
    { label: "Population Neurodivergent", value: "15-20%" }
  ];

  const readingSupports = [
    { title: "Bionic Reading", desc: "Guides the eyes through artificial fixation points.", icon: Eye },
    { title: "Dyslexia Font", desc: "Bottom-heavy letters to anchor text and prevent swapping.", icon: BookOpen },
    { title: "Visual Tinting", desc: "Reduces visual stress and sensory overload.", icon: Layout },
    { title: "Focus Ruler", desc: "Highlights the current line to maintain attention.", icon: Settings2 },
    { title: "Text-to-Speech", desc: "Multimodal learning with synchronized highlighting.", icon: MessageSquare },
    { title: "Declutter Mode", desc: "Removes distracting elements for pure reading.", icon: Shield },
    { title: "Syllable Splitter", desc: "Breaks down complex words for easier decoding.", icon: Edit3 },
    { title: "Contrast Control", desc: "Customizable themes for light sensitivity.", icon: Brain },
  ];

  const modes = [
    { name: "Start", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Sparkles, desc: "Gentle onboarding" },
    { name: "Simplify", color: "bg-teal-100 text-teal-800 border-teal-200", icon: Sparkles, desc: "Reduce complexity" },
    { name: "Learn", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Brain, desc: "Deep comprehension" },
    { name: "Meet", color: "bg-violet-100 text-violet-800 border-violet-200", icon: Users, desc: "Social preparation" },
    { name: "Practice", color: "bg-pink-100 text-pink-800 border-pink-200", icon: CheckCircle, desc: "Skill building" },
    { name: "Write", color: "bg-green-100 text-green-800 border-green-200", icon: Edit3, desc: "Structured output" },
    { name: "Guide", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Focus, desc: "Step-by-step direction" }
  ];

  const unicornFeatures = [
    {
      title: "Breathe Protocol",
      desc: "Instant sensory calm down. One click to blur distractions, dim the screen, and activate guided box breathing.",
      icon: Wind,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      title: "Memory Vault",
      desc: "A secure cognitive offloading space. Auto-saves insights, summaries, and important details so you don't have to remember.",
      icon: Brain,
      color: "text-purple-500",
      bg: "bg-purple-50"
    },
    {
      title: "Task Chunking",
      desc: "Breaks overwhelming projects into micro-steps automatically, reducing executive dysfunction paralysis.",
      icon: ListTodo,
      color: "text-green-500",
      bg: "bg-green-50"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden font-sans selection:bg-teal-200 selection:text-teal-900">
      
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4a7c59] to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-soft">
              S
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-800">SETU</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-teal-700 transition-colors">Features</a>
            <a href="#modes" className="hover:text-teal-700 transition-colors">Cognitive Modes</a>
            <a href="#unicorn" className="hover:text-teal-700 transition-colors">Innovations</a>
          </div>
          <button 
            onClick={() => navigate('/sanctuary')}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all shadow-medium hover:shadow-elevated flex items-center gap-2 group"
          >
            Enter Sanctuary
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden flex flex-col justify-center min-h-[90vh]">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100/40 blur-[120px] mix-blend-multiply animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-100/40 blur-[120px] mix-blend-multiply animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[40%] h-[40%] rounded-full bg-emerald-100/40 blur-[120px] mix-blend-multiply animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-100 text-teal-700 font-medium text-sm mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Capgemini Hack4Positive 2026</span>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.1}>
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.1]">
              The Cognitive <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4a7c59] to-teal-600">
                Operating System
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
              Bridging the gap between dense digital worlds and the neurodivergent mind. 
              Designed for ADHD, Dyslexia, and Autism.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => navigate('/sanctuary')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#4a7c59] to-teal-600 text-white font-semibold text-lg hover:shadow-elevated hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group"
              >
                Enter Sanctuary
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={scrollToFeatures}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-slate-700 font-semibold text-lg border border-slate-200 hover:bg-slate-50 hover:shadow-soft transition-all flex items-center justify-center gap-2 group"
              >
                <Play className="w-5 h-5 text-teal-600 group-hover:scale-110 transition-transform" />
                Watch Demo
              </button>
            </div>
          </FadeIn>

          <FadeIn delay={0.5}>
            <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-200/60 pt-12">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-4xl font-bold text-slate-900 mb-2">{stat.value}</span>
                  <span className="text-slate-500 font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-slate-900 mb-6">Inclusive by Design</h2>
              <p className="text-lg text-slate-600">
                8 core reading supports engineered to reduce cognitive load and visual stress, making the web accessible to everyone.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {readingSupports.map((feature, i) => (
              <FadeIn key={i} delay={0.1 * (i % 4)}>
                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-soft transition-all group h-full">
                  <div className="w-12 h-12 rounded-xl bg-teal-100/50 text-teal-700 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 7 Cognitive Modes */}
      <section id="modes" className="py-24 bg-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">7 Cognitive Modes</h2>
              <p className="text-lg text-slate-300">
                Context-aware intelligence that adapts the interface and content based on your current cognitive need.
              </p>
            </div>
          </FadeIn>

          <div className="flex flex-wrap justify-center gap-4">
            {modes.map((mode, i) => (
              <FadeIn key={i} delay={0.1 * i} direction="up">
                <div className={`px-6 py-4 rounded-2xl border flex flex-col items-center gap-3 w-40 text-center transition-transform hover:-translate-y-1 hover:shadow-lg cursor-default ${mode.color}`}>
                  <mode.icon className="w-8 h-8" />
                  <div>
                    <div className="font-bold">{mode.name}</div>
                    <div className="text-xs opacity-80 mt-1">{mode.desc}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Unicorn Features */}
      <section id="unicorn" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 text-purple-700 font-medium text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                <span>Unicorn Features</span>
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6">Breakthrough Innovations</h2>
              <p className="text-lg text-slate-600">
                Going beyond basic accessibility to provide deep, systemic support for executive dysfunction and sensory overload.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {unicornFeatures.map((feature, i) => (
              <FadeIn key={i} delay={0.2 * i}>
                <div className="glass-card p-8 rounded-3xl h-full border border-slate-200/60 bg-white hover:shadow-elevated transition-shadow relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full ${feature.bg} opacity-50 -z-10`}></div>
                  <div className={`w-14 h-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6`}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed text-lg">{feature.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#4a7c59]"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Ready to experience a calmer digital world?</h2>
            <button 
              onClick={() => navigate('/sanctuary')}
              className="px-10 py-5 rounded-2xl bg-white text-[#4a7c59] font-bold text-xl hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3 mx-auto group"
            >
              Enter Sanctuary
              <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4a7c59] to-teal-600 flex items-center justify-center text-white font-bold shadow-soft">
              S
            </div>
            <span className="font-bold text-xl tracking-tight text-white">SETU</span>
          </div>
          <div className="text-sm">
            Built for <span className="text-teal-400 font-medium">Capgemini Hack4Positive 2026</span>
          </div>
          <div className="text-sm">
            © {new Date().getFullYear()} SETU Project. Theme: Disability Inclusion & Accessibility.
          </div>
        </div>
      </footer>

    </div>
  );
}
