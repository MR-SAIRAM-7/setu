import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Brain, Zap, FileText, Activity } from 'lucide-react';

const mockCognitiveLoadData = [
  { name: 'Mon', original: 100, setu: 45 },
  { name: 'Tue', original: 120, setu: 50 },
  { name: 'Wed', original: 90, setu: 35 },
  { name: 'Thu', original: 110, setu: 40 },
  { name: 'Fri', original: 130, setu: 55 },
  { name: 'Sat', original: 80, setu: 30 },
  { name: 'Sun', original: 95, setu: 40 },
];

const mockModeUsage = [
  { name: 'Start', value: 45, color: '#f59e0b' },
  { name: 'Simplify', value: 85, color: '#14b8a6' },
  { name: 'Learn', value: 65, color: '#3b82f6' },
  { name: 'Meet', value: 25, color: '#8b5cf6' },
  { name: 'Practice', value: 35, color: '#ec4899' },
  { name: 'Write', value: 55, color: '#22c55e' },
  { name: 'Guide', value: 15, color: '#f97316' },
];

const mockProcessingSplit = [
  { name: 'L0 Local (On-Device)', value: 75, color: '#4a7c59' },
  { name: 'L2 Cloud AI', value: 25, color: '#94a3b8' },
];

const StatCard = ({ title, value, icon: Icon, delay, prefix = '', suffix = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="glass-card p-6 flex items-center justify-between"
  >
    <div>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800">
        {prefix}{value}{suffix}
      </h3>
    </div>
    <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center text-sage-600">
      <Icon size={24} />
    </div>
  </motion.div>
);

const Analytics = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 pb-20 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Activity className="text-sage-600" size={36} />
          Trust & Load Ledger
        </h1>
        <p className="text-xl text-gray-600 mt-2">
          Tracking the tangible impact of cognitive load reduction.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Pages Simplified" value={342} icon={FileText} delay={0.1} />
        <StatCard title="Tasks Started" value={128} icon={Zap} delay={0.2} />
        <StatCard title="Mind Maps Created" value={56} icon={Brain} delay={0.3} />
        <StatCard title="Cognitive Load Saved" value={65} icon={TrendingUp} delay={0.4} suffix="%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6">Cognitive Load: Original vs SETU</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockCognitiveLoadData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="original" name="Without SETU" stroke="#94a3b8" strokeWidth={2} />
                <Line type="monotone" dataKey="setu" name="With SETU" stroke="#4a7c59" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6">Mode Usage Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockModeUsage} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {mockModeUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6 lg:col-span-1"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-6">Processing Split</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mockProcessingSplit}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockProcessingSplit.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="glass-card p-6 lg:col-span-2"
        >
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { id: 1, text: "Simplified Wikipedia article on 'Quantum Computing'", mode: "Simplify", time: "2 hours ago", color: "bg-teal-100 text-teal-800" },
              { id: 2, text: "Created mind map for 'Hackathon Plan'", mode: "Learn", time: "4 hours ago", color: "bg-blue-100 text-blue-800" },
              { id: 3, text: "Drafted email to project manager", mode: "Write", time: "Yesterday", color: "bg-green-100 text-green-800" },
              { id: 4, text: "Broken down 'Implement Settings Page' task", mode: "Start", time: "Yesterday", color: "bg-amber-100 text-amber-800" },
            ].map(activity => (
              <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activity.color} whitespace-nowrap`}>
                  {activity.mode}
                </div>
                <div className="flex-1">
                  <p className="text-gray-800">{activity.text}</p>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
