import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, TrendingUp, Calendar } from 'lucide-react';
import './Statistics.css';

const Statistics = () => {
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalWords: 0,
    totalTime: 0,
    avgWPM: 0,
    dailyData: [],
    weeklyData: []
  });

  useEffect(() => {
    // Load statistics
    const loadStats = async () => {
      try {
        const result = await chrome.storage.local.get(['readingStats']);
        if (result.readingStats) {
          setStats(prev => ({
            ...prev,
            totalSessions: result.readingStats.sessions || 0,
            totalWords: result.readingStats.words || 0,
            totalTime: result.readingStats.time || 0,
            avgWPM: result.readingStats.wpm || 200
          }));
        }
      } catch (error) {
        console.log('Storage not available');
        // Use demo data
        setStats({
          totalSessions: 12,
          totalWords: 15420,
          totalTime: 77,
          avgWPM: 200,
          dailyData: [
            { day: 'Mon', words: 1200, time: 6 },
            { day: 'Tue', words: 2100, time: 10 },
            { day: 'Wed', words: 800, time: 4 },
            { day: 'Thu', words: 2500, time: 12 },
            { day: 'Fri', words: 1800, time: 9 },
            { day: 'Sat', words: 3200, time: 16 },
            { day: 'Sun', words: 2820, time: 14 }
          ]
        });
      }
    };

    loadStats();
  }, []);

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatNumber = (num) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  return (
    <div className="statistics">
      <header className="statistics-header">
        <h1>Statistics</h1>
        <p>Track your reading progress</p>
      </header>

      {/* Overview Cards */}
      <section className="overview-section">
        <div className="overview-grid">
          <div className="overview-card">
            <div className="overview-icon">
              <BookOpen size={24} />
            </div>
            <div className="overview-info">
              <span className="overview-value">{formatNumber(stats.totalWords)}</span>
              <span className="overview-label">Words Read</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon">
              <Clock size={24} />
            </div>
            <div className="overview-info">
              <span className="overview-value">{formatTime(stats.totalTime)}</span>
              <span className="overview-label">Reading Time</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon">
              <TrendingUp size={24} />
            </div>
            <div className="overview-info">
              <span className="overview-value">{stats.avgWPM}</span>
              <span className="overview-label">Avg WPM</span>
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-icon">
              <Calendar size={24} />
            </div>
            <div className="overview-info">
              <span className="overview-value">{stats.totalSessions}</span>
              <span className="overview-label">Sessions</span>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Activity */}
      <section className="activity-section">
        <h2>Weekly Activity</h2>
        <div className="activity-card">
          <div className="activity-chart">
            {stats.dailyData?.map((day, index) => (
              <div key={index} className="activity-bar-container">
                <div className="activity-bar-wrapper">
                  <div 
                    className="activity-bar"
                    style={{ 
                      height: `${Math.min(100, (day.words / 3500) * 100)}%`,
                      background: `linear-gradient(180deg, #6366f1, #8b5cf6)`
                    }}
                  >
                    <span className="activity-tooltip">
                      {day.words} words
                      <br />
                      {day.time} min
                    </span>
                  </div>
                </div>
                <span className="activity-label">{day.day}</span>
              </div>
            ))}
          </div>
          
          <div className="activity-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#6366f1' }}></div>
              <span>Words Read</span>
            </div>
          </div>
        </div>
      </section>

      {/* Reading Insights */}
      <section className="insights-section">
        <h2>Reading Insights</h2>
        <div className="insights-grid">
          <div className="insight-card">
            <h3>📈 Reading Speed</h3>
            <p>Your average reading speed is <strong>{stats.avgWPM} WPM</strong>.</p>
            <p className="insight-detail">
              {stats.avgWPM > 250 
                ? 'That\'s above average! Great job!' 
                : stats.avgWPM > 200 
                  ? 'That\'s right on target for comfortable reading.'
                  : 'Take your time - comprehension matters more than speed.'}
            </p>
          </div>

          <div className="insight-card">
            <h3>📚 Consistency</h3>
            <p>You've read for <strong>{stats.totalSessions} sessions</strong>.</p>
            <p className="insight-detail">
              {stats.totalSessions > 10 
                ? 'You\'re building a great reading habit!' 
                : 'Keep it up - consistency is key!'}
            </p>
          </div>

          <div className="insight-card">
            <h3>🎯 Focus Time</h3>
            <p>Total reading time: <strong>{formatTime(stats.totalTime)}</strong>.</p>
            <p className="insight-detail">
              That's {Math.round(stats.totalTime / 60 * 10) / 10} hours of focused reading!
            </p>
          </div>

          <div className="insight-card">
            <h3>💡 Tips</h3>
            <ul>
              <li>Use Focus Mode for long articles</li>
              <li>Try Bionic Reading for faster comprehension</li>
              <li>Take breaks every 20-30 minutes</li>
              <li>Adjust scroll speed to match your pace</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="milestones-section">
        <h2>Milestones</h2>
        <div className="milestones-grid">
          <div className={`milestone-card ${stats.totalWords >= 1000 ? 'achieved' : ''}`}>
            <span className="milestone-icon">🎯</span>
            <h3>First 1,000 Words</h3>
            <p>Read your first 1,000 words</p>
          </div>

          <div className={`milestone-card ${stats.totalWords >= 10000 ? 'achieved' : ''}`}>
            <span className="milestone-icon">📚</span>
            <h3>Book Worm</h3>
            <p>Read 10,000 words</p>
          </div>

          <div className={`milestone-card ${stats.totalTime >= 60 ? 'achieved' : ''}`}>
            <span className="milestone-icon">⏰</span>
            <h3>Hour of Power</h3>
            <p>Read for 1 hour total</p>
          </div>

          <div className={`milestone-card ${stats.totalSessions >= 10 ? 'achieved' : ''}`}>
            <span className="milestone-icon">🔥</span>
            <h3>Consistent Reader</h3>
            <p>Complete 10 reading sessions</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Statistics;
