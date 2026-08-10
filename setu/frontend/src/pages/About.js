import React from 'react';
import { Heart, Github, Twitter, Mail, ExternalLink } from 'lucide-react';
import './About.css';

const About = () => {
  return (
    <div className="about">
      <header className="about-header">
        <div className="about-logo">
          <span className="logo-emoji">🧠</span>
          <h1>NeuroRead</h1>
        </div>
        <p className="about-tagline">
          Making the web accessible for ADHD and Dyslexic minds
        </p>
      </header>

      {/* Mission Section */}
      <section className="mission-section">
        <h2>Our Mission</h2>
        <div className="mission-card">
          <p>
            Roughly <strong>1 in 5 people</strong> have a learning difference like ADHD or Dyslexia. 
            Yet most digital content is designed as a wall of text that creates reading fatigue 
            and mental exhaustion.
          </p>
          <p>
            NeuroRead was built to change that. We believe information shouldn't be a chore. 
            Our tools adapt web content to work with your brain, not against it.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2>What We Offer</h2>
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-emoji">👁️</span>
            <h3>Bionic Reading</h3>
            <p>Bold the first half of words to create visual anchor points that guide your eye.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">🎯</span>
            <h3>Focus Mode</h3>
            <p>Strip away distractions like ads, sidebars, and clutter. Just the content.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">📹</span>
            <h3>Eye Tracking</h3>
            <p>Use your webcam to track gaze and auto-scroll as you read.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">📜</span>
            <h3>Auto Scroll</h3>
            <p>Hands-free reading with adaptive speed based on your pace.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">🔊</span>
            <h3>Text to Speech</h3>
            <p>Listen to content while following along with word highlighting.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">✨</span>
            <h3>Word Highlight</h3>
            <p>Keep your place with a moving highlight that follows your reading.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">🤖</span>
            <h3>AI Summarizer</h3>
            <p>Get key points from any article in seconds with AI-powered summaries.</p>
          </div>

          <div className="feature-item">
            <span className="feature-emoji">🎨</span>
            <h3>Accessibility Themes</h3>
            <p>Dyslexia-friendly fonts, high contrast, sepia, and dark modes.</p>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="impact-section">
        <h2>Why It Matters</h2>
        <div className="impact-stats">
          <div className="impact-stat">
            <span className="impact-number">20%</span>
            <span className="impact-label">of people have a learning difference</span>
          </div>
          <div className="impact-stat">
            <span className="impact-number">70%</span>
            <span className="impact-label">of websites have accessibility issues</span>
          </div>
          <div className="impact-stat">
            <span className="impact-number">∞</span>
            <span className="impact-label">potential for inclusive design</span>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="team-section">
        <h2>Built With Love</h2>
        <div className="team-card">
          <p>
            NeuroRead was created during the <strong>Hack for Infinity</strong> hackathon 
            with a simple goal: make the web more accessible for everyone.
          </p>
          <div className="built-with">
            <span>Built with</span>
            <Heart size={16} className="heart-icon" />
            <span>for the neurodivergent community</span>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-section">
        <h2>Technology</h2>
        <div className="tech-card">
          <div className="tech-list">
            <div className="tech-item">
              <span className="tech-name">Chrome Extension API</span>
              <span className="tech-desc">Manifest V3 for modern browsers</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">React</span>
              <span className="tech-desc">Dashboard interface</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">Node.js / Express</span>
              <span className="tech-desc">AI summarization backend</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">Web Speech API</span>
              <span className="tech-desc">Text-to-speech synthesis</span>
            </div>
            <div className="tech-item">
              <span className="tech-name">OpenAI API</span>
              <span className="tech-desc">Intelligent content summarization</span>
            </div>
          </div>
        </div>
      </section>

      {/* Links Section */}
      <section className="links-section">
        <h2>Connect With Us</h2>
        <div className="links-grid">
          <a href="#" className="link-card">
            <Github size={24} />
            <span>GitHub</span>
            <ExternalLink size={16} />
          </a>
          <a href="#" className="link-card">
            <Twitter size={24} />
            <span>Twitter</span>
            <ExternalLink size={16} />
          </a>
          <a href="#" className="link-card">
            <Mail size={24} />
            <span>Contact</span>
            <ExternalLink size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <p>© 2024 NeuroRead. Made for Hack for Infinity.</p>
        <p className="footer-tagline">Reading that adapts to YOUR brain.</p>
      </footer>
    </div>
  );
};

export default About;
